package service

import (
	"context"
	"errors"
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
	repo        *repository.Repository
	thirdPlaces *places.ThirdPlaceCatalog
	green       *places.GreenSpaceIndex
	elevators   *transit.AccessibilityRegistry
	ranker      *Ranker
	forecaster  Forecaster // may be nil

	mu    sync.Mutex
	shown map[string]shownSet // route ID -> the candidate set it was shown in
}

type shownSet struct {
	userID  string
	pairKey string
	prior   domain.FeatureVector
	routes  []domain.Route
}

// Provider responses are saved in the database (the public API is
// rate-limited, and a planned day should open instantly the next time). How
// long a saved answer is trusted depends on when the trip happens: a trip in
// the past cannot change, a trip in the next day is refreshed often because
// of live delays, anything further out only when the timetable might have moved.
const (
	liveTTL     = 15 * time.Minute
	scheduleTTL = 24 * time.Hour
)

func isFresh(fetchedAt, trip time.Time) bool {
	now := time.Now()
	switch {
	case trip.Before(now):
		return true
	case trip.Sub(now) < 24*time.Hour:
		return now.Sub(fetchedAt) < liveTTL
	default:
		return now.Sub(fetchedAt) < scheduleTTL
	}
}

// Forecaster gives the weather at a place and time.
type Forecaster interface {
	At(ctx context.Context, lat, lon float64, t time.Time) (domain.Weather, error)
}

// SetForecaster enables weather-aware planning (no park detours in the rain).
func (s *RoutingService) SetForecaster(f Forecaster) { s.forecaster = f }

func NewRoutingService(
	primary, fallback transit.Provider,
	repo *repository.Repository,
	thirdPlaces *places.ThirdPlaceCatalog,
	green *places.GreenSpaceIndex,
	elevators *transit.AccessibilityRegistry,
	ranker *Ranker,
) *RoutingService {
	return &RoutingService{
		primary: primary, fallback: fallback, repo: repo,
		thirdPlaces: thirdPlaces, green: green, elevators: elevators, ranker: ranker,
		shown: map[string]shownSet{},
	}
}

// ProviderName reports the configured transit provider.
func (s *RoutingService) ProviderName() string { return s.primary.Name() }

// DayEndpoints resolves where a day starts and ends: the choice saved for that
// date, else home. Either may be nil.
func (s *RoutingService) DayEndpoints(prefs domain.UserPreferences, date string) (origin, destination *domain.DayEndpoint) {
	resolve := func(which string) *domain.DayEndpoint {
		if ep, ok := s.repo.GetDayEndpoint(date, which); ok {
			return &ep
		}
		if home := prefs.HomeLocation; home != nil && hasCoordinates(*home) {
			return &domain.DayEndpoint{Location: *home, Category: "home", IsHome: true}
		}
		return nil
	}
	return resolve("origin"), resolve("destination")
}

// SetDayEndpoint makes a day start ("origin") or end ("destination") somewhere
// other than home. The location must already have coordinates.
func (s *RoutingService) SetDayEndpoint(date, which string, ep domain.DayEndpoint) error {
	if which != "origin" && which != "destination" {
		return errors.New(`endpoint must be "origin" or "destination"`)
	}
	if _, err := time.Parse("2006-01-02", date); err != nil {
		return errors.New("date must be YYYY-MM-DD")
	}
	if !hasCoordinates(ep.Location) {
		return errors.New("the location has no coordinates")
	}
	ep.IsHome = false
	s.repo.SaveDayEndpoint(date, which, ep)
	return nil
}

// ResetDayEndpoint puts a day's start or end back to home.
func (s *RoutingService) ResetDayEndpoint(date, which string) {
	s.repo.DeleteDayEndpoint(date, which)
}

// GetDaySchedule builds the day view for one local date: the events, the
// commutes between them, and the trips from where the day starts to the
// first event and from the last event to where the day ends.
func (s *RoutingService) GetDaySchedule(ctx context.Context, userID string, date time.Time, natureOverride *bool) (domain.DaySchedule, error) {
	y, m, d := date.Date()
	dayStart := time.Date(y, m, d, 0, 0, 0, 0, date.Location())
	events := s.repo.GetEventsBetween(dayStart, dayStart.AddDate(0, 0, 1))
	dateKey := dayStart.Format("2006-01-02")

	prefs := s.repo.GetUserPreferences(userID)
	natureMode := prefs.PreferNatureRoutes
	if natureOverride != nil {
		natureMode = *natureOverride
	}
	origin, destination := s.DayEndpoints(prefs, dateKey)

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
	add := func(t trip, to string) {
		if !isDifferentLocation(t.origin, t.dest) {
			return
		}
		route, err := s.planCommute(ctx, userID, prefs, natureMode, t)
		if err != nil {
			log.Printf("routing %s -> %s failed: %v", t.origin.Name, to, err)
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
	// Arrive `buffer` minutes before an event starts. The route's departure
	// time is then exactly the "time to leave".
	arriveFor := func(e domain.Event) time.Time {
		return e.StartTime.Add(-time.Duration(prefs.DepartureBufferMinutes) * time.Minute)
	}

	if origin != nil && len(located) > 0 {
		first := located[0]
		add(trip{origID: domain.DayStartID, destID: first.ID, origin: origin.Location, dest: first.Location,
			when: arriveFor(first), arriveBy: true, due: &first.StartTime}, first.Title)
	}
	for i := 0; i+1 < len(located); i++ {
		orig, dest := located[i], located[i+1]
		add(trip{origID: orig.ID, destID: dest.ID, origin: orig.Location, dest: dest.Location,
			when: arriveFor(dest), arriveBy: true, freeFrom: &orig.EndTime, due: &dest.StartTime}, dest.Title)
	}
	// The trip back leaves when the last event ends; when it arrives is
	// whatever the route takes.
	if destination != nil && len(located) > 0 {
		last := located[len(located)-1]
		add(trip{origID: last.ID, destID: domain.DayEndID, origin: last.Location, dest: destination.Location,
			when: last.EndTime, freeFrom: &last.EndTime}, destination.Location.Name)
	}
	summary.TotalCO2SavedGrams = round2(summary.TotalCO2SavedGrams)

	// Remember what the day adds up to, for the weekly totals and the streak.
	s.repo.UpdateDayStats(dateKey, func(st *domain.DayStats) {
		st.CommuteMinutes = summary.TotalCommuteMinutes
		st.PlannedSteps = summary.TotalSteps
		st.CO2SavedGrams = summary.TotalCO2SavedGrams
		st.TouchedGrass = touchedGrass
	})

	return domain.DaySchedule{Date: dateKey, Events: events, Commutes: commutes, Summary: summary,
		Origin: origin, Destination: destination}, nil
}

// trip is one commute to plan.
type trip struct {
	origID, destID string // event IDs, or domain.DayStartID / domain.DayEndID
	origin, dest   domain.Location
	when           time.Time  // arrive by this time, or leave at it
	arriveBy       bool       // how `when` is meant
	freeFrom       *time.Time // when the user becomes free at the origin (nil: any time)
	due            *time.Time // when the user is expected at the destination (nil: no deadline)
}

func (s *RoutingService) planCommute(ctx context.Context, userID string, prefs domain.UserPreferences, natureMode bool, t trip) (domain.Route, error) {
	req := transit.PlanRequest{Origin: t.origin, Dest: t.dest, Time: t.when, ArriveBy: t.arriveBy, Prefs: prefs}
	candidates, err := s.candidates(ctx, req)
	if err != nil {
		return domain.Route{}, err
	}

	// Weather decides whether outdoor detours make sense at all.
	var weather *domain.Weather
	if s.forecaster != nil {
		if w, err := s.forecaster.At(ctx, t.dest.Latitude, t.dest.Longitude, t.when); err == nil {
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
	if len(candidates) == 0 {
		return domain.Route{}, errors.New("no itinerary found")
	}

	for i := range candidates {
		c := &candidates[i]
		c.OriginEventID, c.DestinationEventID = t.origID, t.destID
		c.Weather = weather
		c.IsTight = t.due != nil && c.ArrivalTime.After(*t.due)
		// Where service is hourly, the options differ far more in when they
		// run than in how long they take. Count the time spent waiting:
		// an option that arrives two hours early is not a "faster" one.
		wait := c.DepartureTime.Sub(t.when)
		if t.arriveBy {
			wait = t.when.Sub(c.ArrivalTime)
		}
		if wait > 0 {
			c.WaitMinutes = int(wait.Minutes())
		}
		if t.freeFrom != nil {
			c.SlackMinutes = int(c.DepartureTime.Sub(*t.freeFrom).Minutes())
			c.IsTight = c.IsTight || c.DepartureTime.Before(*t.freeFrom)
		}
	}

	pairKey := t.origID + ">" + t.destID
	best := s.rank(ctx, userID, prefs, natureMode, pairKey, candidates)

	// Free time before having to leave: suggest places whose detour fits in
	// it. In bad weather only indoor places are suggested.
	if prefs.AllowThirdPlaceDetours && t.due != nil && best.SlackMinutes >= 10 {
		maxDetour := best.SlackMinutes
		if maxDetour > 30 {
			maxDetour = 30
		}
		best.SuggestedThirdPlaces = s.thirdPlaces.FindNearbyThirdPlaces(t.origin, t.dest, maxDetour, !outdoorsOK, 5)
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

	key := fmt.Sprintf("v2/%s/park:%.4f,%.4f>%.4f,%.4f@%d/%v", s.primary.Name(), o.Latitude, o.Longitude, d.Latitude, d.Longitude, req.Time.Unix()/300, req.ArriveBy)
	routes, fetchedAt, hit := s.repo.GetRoutes(key)
	if !hit || !isFresh(fetchedAt, req.Time) {
		routes = nil // an empty answer is saved too: "no park route"
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
			routes = []domain.Route{{
				ID:             fmt.Sprintf("park-%d-%d", start.Unix(), start.Add(d1+d2).Unix()),
				OriginLocation: o, DestinationLocation: d,
				DepartureTime: start, ArrivalTime: start.Add(d1 + d2),
				Nodes: []domain.IntermodalNode{a, b}, Source: s.primary.Name(), IsParkWalk: true,
			}}
		} else if err1 != nil || err2 != nil {
			log.Printf("park walk via %s not available: %v %v", park.Name, err1, err2)
		}
		s.repo.SaveRoutes(key, req.Time, routes)
	}
	if len(routes) == 0 {
		return domain.Route{}, false
	}
	route := routes[0]
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
	if len(candidates) == 0 {
		return domain.Route{}, errors.New("no itinerary found")
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
	s.mu.Unlock()
	if ok && set.pairKey != "" {
		for _, r := range set.routes {
			if r.ID == routeID {
				s.repo.SaveRouteChoice(set.pairKey, routeSignature(r))
			}
		}
	}
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
	key := fmt.Sprintf("v2/%s/%.4f,%.4f>%.4f,%.4f@%d/%v/%v", s.primary.Name(),
		req.Origin.Latitude, req.Origin.Longitude, req.Dest.Latitude, req.Dest.Longitude,
		req.Time.Unix()/300, req.ArriveBy, req.Prefs.RequireElevator)

	routes, fetchedAt, hit := s.repo.GetRoutes(key)
	if !hit || !isFresh(fetchedAt, req.Time) {
		fetched, err := s.primary.Plan(ctx, req)
		switch {
		case err == nil:
			routes = fetched
			s.repo.SaveRoutes(key, req.Time, routes)
		case hit:
			// Better an itinerary planned earlier than none (or a made-up one).
			log.Printf("transit provider %q failed (%v); using the route saved %s", s.primary.Name(), err, fetchedAt.Format(time.RFC3339))
		case s.fallback == nil || errors.Is(err, transit.ErrNoItineraries):
			return nil, err
		default:
			log.Printf("transit provider %q failed (%v); using %q", s.primary.Name(), err, s.fallback.Name())
			if routes, err = s.fallback.Plan(ctx, req); err != nil {
				return nil, err
			}
		}
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
	elapsed := total + float64(r.WaitMinutes) // door to deadline, not just the ride
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
		domain.FeatDuration:     round3(elapsed / 60),
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

	// An explicit earlier choice for this commute wins over the ranking.
	if sig, ok := s.repo.GetRouteChoice(pairKey); ok && pairKey != "" {
		for i := range candidates {
			if routeSignature(candidates[i]) == sig {
				picked := candidates[i]
				picked.Reason = "You chose this option"
				candidates = append(append([]domain.Route{picked}, candidates[:i]...), candidates[i+1:]...)
				break
			}
		}
	}
	s.mu.Lock()
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
