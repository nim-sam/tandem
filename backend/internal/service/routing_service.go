package service

import (
	"context"
	"fmt"
	"log"
	"math"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/nim-sam/codejam16/backend/internal/adapter/places"
	"github.com/nim-sam/codejam16/backend/internal/adapter/repository"
	"github.com/nim-sam/codejam16/backend/internal/adapter/transit"
	"github.com/nim-sam/codejam16/backend/internal/domain"
)

// RoutingService turns a day of calendar events into commutes.
//
// For each pair of consecutive events at different places it:
//  1. asks the transit provider for candidate itineraries that arrive in time
//     (pathfinding is entirely the provider's job),
//  2. enriches each candidate with steps, CO2, green-space and accessibility data,
//  3. has the Ranker order them for this user,
//  4. returns the best one, with the others attached as alternatives.
type RoutingService struct {
	primary     transit.Provider
	fallback    transit.Provider // used when primary fails; may be nil
	repo        *repository.MemoryRepository
	thirdPlaces *places.ThirdPlaceCatalog
	green       *places.GreenSpaceIndex
	elevators   *transit.AccessibilityRegistry
	ranker      *Ranker
	forecaster  Forecaster // may be nil

	mu       sync.Mutex
	cache    map[string]cacheEntry // provider responses; the public API is rate-limited
	shown    map[string]shownSet   // route ID -> the candidate set it was shown in
	selected map[string]string     // "origEvent>destEvent" -> route signature the user picked
}

type cacheEntry struct {
	routes []domain.Route
	at     time.Time
}

type shownSet struct {
	userID  string
	pairKey string
	prior   domain.FeatureVector
	routes  []domain.Route
}

const cacheTTL = 15 * time.Minute

// Forecaster gives the weather at a place and time.
type Forecaster interface {
	At(ctx context.Context, lat, lon float64, t time.Time) (domain.Weather, error)
}

// SetForecaster enables weather-aware planning (no park detours in the rain).
func (s *RoutingService) SetForecaster(f Forecaster) { s.forecaster = f }

// homeEventID marks a commute that starts from the user's home.
const homeEventID = "home"

func NewRoutingService(
	primary, fallback transit.Provider,
	repo *repository.MemoryRepository,
	thirdPlaces *places.ThirdPlaceCatalog,
	green *places.GreenSpaceIndex,
	elevators *transit.AccessibilityRegistry,
	ranker *Ranker,
) *RoutingService {
	return &RoutingService{
		primary: primary, fallback: fallback, repo: repo,
		thirdPlaces: thirdPlaces, green: green, elevators: elevators, ranker: ranker,
		cache: map[string]cacheEntry{}, shown: map[string]shownSet{}, selected: map[string]string{},
	}
}

// ProviderName reports the configured transit provider.
func (s *RoutingService) ProviderName() string { return s.primary.Name() }

// GetDaySchedule builds the day view for one local date: events and the commutes between them.
func (s *RoutingService) GetDaySchedule(ctx context.Context, userID string, date time.Time, natureOverride *bool) (domain.DaySchedule, error) {
	y, m, d := date.Date()
	var events []domain.Event
	for _, e := range s.repo.GetEvents() {
		ey, em, ed := e.StartTime.In(date.Location()).Date()
		if ey == y && em == m && ed == d {
			events = append(events, e)
		}
	}
	sort.Slice(events, func(i, j int) bool { return events[i].StartTime.Before(events[j].StartTime) })

	prefs := s.repo.GetUserPreferences(userID)
	natureMode := prefs.PreferNatureRoutes
	if natureOverride != nil {
		natureMode = *natureOverride
	}

	// Only events with a resolved location can be routed between.
	var located []domain.Event
	for _, e := range events {
		if hasCoordinates(e.Location) {
			located = append(located, e)
		}
	}

	commutes := []domain.Route{}
	summary := domain.DaySummary{TotalEvents: len(events)}
	touchedGrass := false
	add := func(route domain.Route, err error, from, to string) {
		if err != nil {
			log.Printf("routing %s -> %s failed: %v", from, to, err)
			return
		}
		commutes = append(commutes, route)
		summary.TotalCommuteMinutes += route.TotalDurationMinutes
		summary.TotalSteps += route.TotalSteps
		summary.TotalCO2SavedGrams += route.CO2SavedGrams
		if len(route.SuggestedThirdPlaces) > 0 {
			summary.NatureDetourEligible = true
		}
		if route.IsParkWalk || route.NatureScore >= 0.25 {
			touchedGrass = true
		}
	}

	// The first commute of the day starts at home, when the user has set one.
	if home := prefs.HomeLocation; home != nil && len(located) > 0 && hasCoordinates(*home) && isDifferentLocation(*home, located[0].Location) {
		route, err := s.planCommute(ctx, userID, prefs, natureMode, homeEventID, *home, nil, located[0])
		add(route, err, "home", located[0].Title)
	}
	for i := 0; i+1 < len(located); i++ {
		orig, dest := located[i], located[i+1]
		if !isDifferentLocation(orig.Location, dest.Location) {
			continue
		}
		route, err := s.planCommute(ctx, userID, prefs, natureMode, orig.ID, orig.Location, &orig.EndTime, dest)
		add(route, err, orig.Title, dest.Title)
	}
	summary.TotalCO2SavedGrams = round2(summary.TotalCO2SavedGrams)

	// Remember what the day adds up to, for the weekly totals and the streak.
	s.repo.UpdateDayStats(date.Format("2006-01-02"), func(st *domain.DayStats) {
		st.CommuteMinutes = summary.TotalCommuteMinutes
		st.PlannedSteps = summary.TotalSteps
		st.CO2SavedGrams = summary.TotalCO2SavedGrams
		st.TouchedGrass = touchedGrass
	})

	if events == nil {
		events = []domain.Event{}
	}
	return domain.DaySchedule{Date: date.Format("2006-01-02"), Events: events, Commutes: commutes, Summary: summary}, nil
}

// planCommute plans the trip to dest. origEnd is when the user becomes free
// at the origin (nil when starting from home: any departure time is fine).
func (s *RoutingService) planCommute(ctx context.Context, userID string, prefs domain.UserPreferences, natureMode bool,
	origID string, origin domain.Location, origEnd *time.Time, dest domain.Event) (domain.Route, error) {
	// Arrive `buffer` minutes before the next event starts. The route's
	// departure time is then exactly the "time to leave".
	deadline := dest.StartTime.Add(-time.Duration(prefs.DepartureBufferMinutes) * time.Minute)
	req := transit.PlanRequest{Origin: origin, Dest: dest.Location, Time: deadline, ArriveBy: true, Prefs: prefs}
	candidates, err := s.candidates(ctx, req)
	if err != nil {
		return domain.Route{}, err
	}

	// Weather decides whether outdoor detours make sense at all.
	var weather *domain.Weather
	if s.forecaster != nil {
		if w, err := s.forecaster.At(ctx, dest.Location.Latitude, dest.Location.Longitude, deadline); err == nil {
			weather = &w
		}
	}
	outdoorsOK := weather == nil || weather.GoodForOutdoors
	if !outdoorsOK {
		natureMode = false
	}

	// "Touch grass" candidate: a walk deliberately routed through a park.
	if natureMode {
		if park, ok := s.parkWalk(ctx, req); ok {
			candidates = append(candidates, park)
		}
	}

	for i := range candidates {
		c := &candidates[i]
		c.OriginEventID, c.DestinationEventID = origID, dest.ID
		c.Weather = weather
		c.IsTight = c.ArrivalTime.After(dest.StartTime)
		if origEnd != nil {
			c.SlackMinutes = int(c.DepartureTime.Sub(*origEnd).Minutes())
			c.IsTight = c.IsTight || c.DepartureTime.Before(*origEnd)
		}
	}

	pairKey := origID + ">" + dest.ID
	best := s.rank(ctx, userID, prefs, natureMode, pairKey, candidates)

	// Free time before having to leave: suggest places whose detour fits in
	// it. In bad weather only indoor places are suggested.
	if prefs.AllowThirdPlaceDetours && best.SlackMinutes >= 10 {
		maxDetour := best.SlackMinutes
		if maxDetour > 30 {
			maxDetour = 30
		}
		best.SuggestedThirdPlaces = s.thirdPlaces.FindNearbyThirdPlaces(origin, dest.Location, maxDetour, !outdoorsOK, 5)
	}
	return best, nil
}

// parkWalk builds a walking route through the best park between the two
// points. It only applies to trips short enough to walk (<= 2.5 km direct)
// and needs a provider that can route walks. Costs two provider requests,
// cached like any other.
func (s *RoutingService) parkWalk(ctx context.Context, req transit.PlanRequest) (domain.Route, bool) {
	walker, ok := s.primary.(transit.WalkPlanner)
	if !ok {
		return domain.Route{}, false
	}
	o, d := req.Origin, req.Dest
	if transit.HaversineMeters(o.Latitude, o.Longitude, d.Latitude, d.Longitude) > 2500 {
		return domain.Route{}, false
	}
	park, ok := s.green.BestParkBetween(o.Latitude, o.Longitude, d.Latitude, d.Longitude, 0.8)
	if !ok {
		return domain.Route{}, false
	}

	key := fmt.Sprintf("park:%.4f,%.4f>%.4f,%.4f@%d/%v", o.Latitude, o.Longitude, d.Latitude, d.Longitude, req.Time.Unix()/300, req.ArriveBy)
	s.mu.Lock()
	entry, hit := s.cache[key]
	s.mu.Unlock()
	if !hit || time.Since(entry.at) >= cacheTTL {
		entry = cacheEntry{at: time.Now()} // an empty entry caches "no park route" too
		via := domain.Location{Name: park.Name, Latitude: park.Lat, Longitude: park.Lon}
		first, err1 := walker.PlanWalk(ctx, o, via, req.Time)
		second, err2 := walker.PlanWalk(ctx, via, d, req.Time)
		if err1 == nil && err2 == nil && len(first.Nodes) > 0 && len(second.Nodes) > 0 {
			d1, d2 := first.ArrivalTime.Sub(first.DepartureTime), second.ArrivalTime.Sub(second.DepartureTime)
			start := req.Time
			if req.ArriveBy {
				start = req.Time.Add(-d1 - d2)
			}
			a, b := first.Nodes[0], second.Nodes[0]
			a.ID, a.SequenceIndex, a.NodeType = "leg-0", 0, domain.NodeDeparture
			a.DepartureTime, a.ArrivalTime = start, start.Add(d1)
			a.Instruction = "Walk to " + park.Name
			b.ID, b.SequenceIndex, b.NodeType = "leg-1", 1, domain.NodeArrival
			b.DepartureTime, b.ArrivalTime = start.Add(d1), start.Add(d1+d2)
			b.Instruction = fmt.Sprintf("Walk through %s to %s", park.Name, d.Name)
			entry.routes = []domain.Route{{
				ID:             fmt.Sprintf("park-%d-%d", start.Unix(), start.Add(d1+d2).Unix()),
				OriginLocation: o, DestinationLocation: d,
				DepartureTime: start, ArrivalTime: start.Add(d1 + d2),
				Nodes: []domain.IntermodalNode{a, b}, Source: s.primary.Name(), IsParkWalk: true,
			}}
		} else if err1 != nil || err2 != nil {
			log.Printf("park walk via %s not available: %v %v", park.Name, err1, err2)
		}
		s.mu.Lock()
		s.cache[key] = entry
		s.mu.Unlock()
	}
	if len(entry.routes) == 0 {
		return domain.Route{}, false
	}
	route := entry.routes[0]
	route.Nodes = append([]domain.IntermodalNode(nil), route.Nodes...)
	s.enrich(&route)
	route.IsNatureFocused = true
	return route, true
}

// PlanCustomRoute plans a trip leaving now between two arbitrary points.
func (s *RoutingService) PlanCustomRoute(ctx context.Context, userID string, origin, dest domain.Location, natureFocused bool) (domain.Route, error) {
	prefs := s.repo.GetUserPreferences(userID)
	candidates, err := s.candidates(ctx, transit.PlanRequest{Origin: origin, Dest: dest, Time: time.Now(), Prefs: prefs})
	if err != nil {
		return domain.Route{}, err
	}
	if natureFocused {
		if park, ok := s.parkWalk(ctx, transit.PlanRequest{Origin: origin, Dest: dest, Time: time.Now()}); ok {
			candidates = append(candidates, park)
		}
	}
	best := s.rank(ctx, userID, prefs, natureFocused, "", candidates)
	if natureFocused {
		best.SuggestedThirdPlaces = s.thirdPlaces.FindNearbyThirdPlaces(origin, dest, 20, false, 5)
	}
	return best, nil
}

// SelectRoute records that the user chose routeID over the alternatives it was
// shown with. The choice sticks for that commute and is sent to the ML agent
// as a training signal.
func (s *RoutingService) SelectRoute(ctx context.Context, routeID string) error {
	s.mu.Lock()
	set, ok := s.shown[routeID]
	if ok && set.pairKey != "" {
		for _, r := range set.routes {
			if r.ID == routeID {
				s.selected[set.pairKey] = routeSignature(r)
			}
		}
	}
	s.mu.Unlock()
	if !ok {
		return fmt.Errorf("unknown route %q (routes expire when the schedule is re-planned)", routeID)
	}

	var chosen domain.FeatureVector
	var rejected []domain.FeatureVector
	for _, r := range set.routes {
		if r.ID == routeID {
			chosen = r.Features
		} else {
			rejected = append(rejected, r.Features)
		}
	}
	if chosen == nil || len(rejected) == 0 {
		return nil // nothing to learn from a single option
	}
	if err := s.ranker.Feedback(ctx, set.userID, set.prior, chosen, rejected); err != nil {
		log.Printf("ml agent feedback not recorded: %v", err)
	}
	return nil
}

// candidates fetches, caches and enriches itineraries from the provider.
func (s *RoutingService) candidates(ctx context.Context, req transit.PlanRequest) ([]domain.Route, error) {
	key := fmt.Sprintf("%.4f,%.4f>%.4f,%.4f@%d/%v/%v",
		req.Origin.Latitude, req.Origin.Longitude, req.Dest.Latitude, req.Dest.Longitude,
		req.Time.Unix()/300, req.ArriveBy, req.Prefs.RequireElevator)

	s.mu.Lock()
	entry, hit := s.cache[key]
	s.mu.Unlock()

	var routes []domain.Route
	if hit && time.Since(entry.at) < cacheTTL {
		routes = entry.routes
	} else {
		var err error
		routes, err = s.primary.Plan(ctx, req)
		if err != nil {
			if s.fallback == nil {
				return nil, err
			}
			log.Printf("transit provider %q failed (%v); using %q", s.primary.Name(), err, s.fallback.Name())
			if routes, err = s.fallback.Plan(ctx, req); err != nil {
				return nil, err
			}
		}
		s.mu.Lock()
		s.cache[key] = cacheEntry{routes: routes, at: time.Now()}
		s.mu.Unlock()
	}

	// Copy so per-request fields never leak into the cache.
	out := make([]domain.Route, len(routes))
	for i, r := range routes {
		r.Nodes = append([]domain.IntermodalNode(nil), r.Nodes...)
		s.enrich(&r)
		out[i] = r
	}
	return out, nil
}

// enrich computes everything the provider does not: steps, green-space
// exposure, elevator access, CO2 and totals.
func (s *RoutingService) enrich(r *domain.Route) {
	var walkMeters, greenMeters, co2 float64
	r.TotalDurationMinutes = int(math.Round(r.ArrivalTime.Sub(r.DepartureTime).Minutes()))
	r.TotalDistanceMeters, r.TotalSteps, r.WalkMinutes = 0, 0, 0
	r.IsAccessible = true

	for i := range r.Nodes {
		n := &r.Nodes[i]
		switch n.Mode {
		case domain.ModeWalk:
			n.StepCount = int(float64(n.DistanceMeters) / 0.75) // ~0.75 m per step
			n.ElevatorAvailable = true
			if n.Polyline != "" {
				pts := transit.DecodePolyline(n.Polyline, n.PolylinePrecision)
				lats, lons := make([]float64, len(pts)), make([]float64, len(pts))
				for j, p := range pts {
					lats[j], lons[j] = p.Lat, p.Lon
				}
				n.NatureScore, n.GreenSpaces = s.green.Score(lats, lons)
				n.NatureScore = round2(n.NatureScore)
				if len(n.GreenSpaces) > 0 && n.NatureScore >= 0.2 && !r.IsParkWalk {
					n.Instruction += " (via " + strings.Join(n.GreenSpaces, ", ") + ")"
				}
			}
			walkMeters += float64(n.DistanceMeters)
			greenMeters += float64(n.DistanceMeters) * n.NatureScore
			r.WalkMinutes += n.DurationMinutes
		case domain.ModeMetro:
			from, to := s.elevators.HasWorkingElevator(n.StationOrStopName), s.elevators.HasWorkingElevator(n.ToStopName)
			n.ElevatorAvailable = from && to
			switch {
			case from && to:
				n.AccessibilityNotes = "Elevators at both stations"
			case !from:
				n.AccessibilityNotes = "No elevator at " + n.StationOrStopName
			default:
				n.AccessibilityNotes = "No elevator at " + n.ToStopName
			}
		default:
			n.ElevatorAvailable = n.VehicleAccessible
			if !n.VehicleAccessible {
				n.AccessibilityNotes = "This trip is not marked wheelchair accessible"
			}
		}
		if !n.ElevatorAvailable {
			r.IsAccessible = false
		}
		r.TotalDistanceMeters += n.DistanceMeters
		r.TotalSteps += n.StepCount
		co2 += float64(n.DistanceMeters) / 1000 * domain.TransitModeCO2GramsPerKm[n.Mode]
	}

	if walkMeters > 0 {
		r.NatureScore = round2(greenMeters / walkMeters)
	}
	r.IsNatureFocused = r.NatureScore >= 0.25
	baseline := float64(r.TotalDistanceMeters) / 1000 * domain.BaselineCarCO2GramsPerKm
	r.CO2EmissionsGrams = round2(co2)
	r.CO2SavedGrams = round2(math.Max(0, baseline-co2))
}

func features(r domain.Route, prefs domain.UserPreferences) domain.FeatureVector {
	total := math.Max(1, float64(r.TotalDurationMinutes))
	modeMinutes := map[domain.TransitMode]float64{}
	for _, n := range r.Nodes {
		modeMinutes[n.Mode] += float64(n.DurationMinutes)
	}
	b2f := func(b bool) float64 {
		if b {
			return 1
		}
		return 0
	}
	co2Fraction := 0.0
	if all := r.CO2SavedGrams + r.CO2EmissionsGrams; all > 0 {
		co2Fraction = r.CO2SavedGrams / all
	}
	walk := float64(r.WalkMinutes)
	return domain.FeatureVector{
		domain.FeatDuration:     round3(total / 60),
		domain.FeatTransfers:    round3(float64(r.TransferCount) / 3),
		domain.FeatWalk:         round3(walk / 30),
		domain.FeatOverWalk:     round3(math.Max(0, walk-float64(prefs.MaxWalkingMinutes)) / 15),
		domain.FeatCO2Saved:     round3(co2Fraction),
		domain.FeatNature:       r.NatureScore,
		domain.FeatBus:          round3(modeMinutes[domain.ModeBus] / total),
		domain.FeatMetro:        round3(modeMinutes[domain.ModeMetro] / total),
		domain.FeatREM:          round3(modeMinutes[domain.ModeREM] / total),
		domain.FeatTrain:        round3(modeMinutes[domain.ModeTrain] / total),
		domain.FeatInaccessible: b2f(!r.IsAccessible),
		domain.FeatTight:        b2f(r.IsTight),
	}
}

// rank orders candidates and returns the best with the rest as Alternatives.
func (s *RoutingService) rank(ctx context.Context, userID string, prefs domain.UserPreferences, natureMode bool, pairKey string, candidates []domain.Route) domain.Route {
	prior := domain.PriorWeights(prefs, natureMode)
	vectors := make([]domain.FeatureVector, len(candidates))
	for i := range candidates {
		candidates[i].Features = features(candidates[i], prefs)
		vectors[i] = candidates[i].Features
	}

	result := s.ranker.Rank(ctx, userID, prior, vectors)
	for i := range candidates {
		candidates[i].Score = round2(result.Scores[i])
		candidates[i].RankedBy = result.RankedBy
		candidates[i].Reason = explain(i, vectors, result.Weights)
	}
	sort.SliceStable(candidates, func(i, j int) bool { return candidates[i].Score > candidates[j].Score })

	s.mu.Lock()
	// An explicit earlier choice for this commute wins over the ranking.
	if sig, ok := s.selected[pairKey]; ok && pairKey != "" {
		for i := range candidates {
			if routeSignature(candidates[i]) == sig {
				picked := candidates[i]
				picked.Reason = "You chose this option"
				candidates = append(append([]domain.Route{picked}, candidates[:i]...), candidates[i+1:]...)
				break
			}
		}
	}
	if len(s.shown) > 2000 {
		s.shown = map[string]shownSet{}
	}
	set := shownSet{userID: userID, pairKey: pairKey, prior: prior, routes: append([]domain.Route(nil), candidates...)}
	for _, c := range candidates {
		s.shown[c.ID] = set
	}
	s.mu.Unlock()

	best := candidates[0]
	if len(candidates) > 1 {
		best.Alternatives = candidates[1:]
	}
	return best
}

// explain names the two features that most lift candidate i above the average
// of the options it was compared with.
func explain(i int, vectors []domain.FeatureVector, weights domain.FeatureVector) string {
	if len(vectors) < 2 {
		return "Only option found"
	}
	// label when the value is above / below the average of the candidates
	labels := map[string][2]string{
		domain.FeatDuration:     {"slower", "faster"},
		domain.FeatTransfers:    {"more transfers", "fewer transfers"},
		domain.FeatWalk:         {"more walking", "less walking"},
		domain.FeatOverWalk:     {"long walk", "walk within your limit"},
		domain.FeatCO2Saved:     {"lower emissions", "higher emissions"},
		domain.FeatNature:       {"greener walk", "less green"},
		domain.FeatBus:          {"more bus", "less bus"},
		domain.FeatMetro:        {"more metro", "less metro"},
		domain.FeatREM:          {"more REM", "less REM"},
		domain.FeatTrain:        {"more train", "less train"},
		domain.FeatInaccessible: {"not step-free", "step-free"},
		domain.FeatTight:        {"tight timing", "fits your schedule"},
	}
	type contribution struct {
		label string
		value float64
	}
	var parts []contribution
	for name, pair := range labels {
		mean := 0.0
		for _, v := range vectors {
			mean += v[name]
		}
		mean /= float64(len(vectors))
		diff := vectors[i][name] - mean
		c := weights[name] * diff
		if c > 0.03 {
			label := pair[0]
			if diff < 0 {
				label = pair[1]
			}
			parts = append(parts, contribution{label, c})
		}
	}
	if len(parts) == 0 {
		return "Similar to the other options"
	}
	sort.Slice(parts, func(a, b int) bool {
		if parts[a].value != parts[b].value {
			return parts[a].value > parts[b].value
		}
		return parts[a].label < parts[b].label
	})
	if len(parts) > 2 {
		parts = parts[:2]
	}
	out := make([]string, len(parts))
	for j, p := range parts {
		out[j] = p.label
	}
	s := strings.Join(out, ", ")
	return strings.ToUpper(s[:1]) + s[1:]
}

// routeSignature identifies "the same option" across re-plans (IDs change with departure times).
func routeSignature(r domain.Route) string {
	var sb strings.Builder
	if r.IsParkWalk {
		sb.WriteString("park|")
	}
	for _, n := range r.Nodes {
		fmt.Fprintf(&sb, "%s:%s|", n.Mode, n.TransitLine)
	}
	return sb.String()
}

func hasCoordinates(l domain.Location) bool { return l.Latitude != 0 || l.Longitude != 0 }

func isDifferentLocation(loc1, loc2 domain.Location) bool {
	return math.Abs(loc1.Latitude-loc2.Latitude) > 0.001 || math.Abs(loc1.Longitude-loc2.Longitude) > 0.001
}

func round2(v float64) float64 { return math.Round(v*100) / 100 }
func round3(v float64) float64 { return math.Round(v*1000) / 1000 }
