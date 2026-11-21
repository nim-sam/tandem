package transit

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"
	"unicode"

	"github.com/nim-sam/codejam16/backend/internal/domain"
)

// MotisProvider plans public-transit trips through a MOTIS routing server.
// The default server is Transitous (https://transitous.org), a free,
// community-run instance that includes STM, REM, exo, RTL and STL schedules.
// The same client works against a self-hosted MOTIS if the public one is
// unavailable: point TRANSIT_API_URL at it.
type MotisProvider struct {
	baseURL   string
	userAgent string
	http      *http.Client
}

func NewMotisProvider(baseURL, userAgent string) *MotisProvider {
	return &MotisProvider{
		baseURL:   strings.TrimRight(baseURL, "/"),
		userAgent: userAgent,
		http:      &http.Client{Timeout: 12 * time.Second},
	}
}

// Name says which server answers: the public Transitous one, or a MOTIS of
// our own (make routing). Saved routes are kept apart by this name, so
// switching servers never serves the other one's itineraries.
func (p *MotisProvider) Name() string {
	if strings.Contains(p.baseURL, "transitous") {
		return "transitous"
	}
	return "motis"
}

type motisPlace struct {
	Name     string    `json:"name"`
	Lat      float64   `json:"lat"`
	Lon      float64   `json:"lon"`
	StopCode string    `json:"stopCode"` // the number printed on the stop's sign
	Arrival  time.Time `json:"arrival"`
}

type motisLeg struct {
	Mode               string     `json:"mode"`
	From               motisPlace `json:"from"`
	To                 motisPlace `json:"to"`
	Duration           int        `json:"duration"` // seconds
	StartTime          time.Time  `json:"startTime"`
	EndTime            time.Time  `json:"endTime"`
	ScheduledStartTime time.Time  `json:"scheduledStartTime"`
	RealTime           bool       `json:"realTime"`
	Distance           float64    `json:"distance"` // metres; only set on street legs
	LegGeometry        struct {
		Points    string `json:"points"`
		Precision int    `json:"precision"`
	} `json:"legGeometry"`
	Headsign             string       `json:"headsign"`
	RouteShortName       string       `json:"routeShortName"`
	RouteLongName        string       `json:"routeLongName"`
	RouteColor           string       `json:"routeColor"`
	AgencyName           string       `json:"agencyName"`
	AgencyID             string       `json:"agencyId"`
	WheelchairAccessible any          `json:"wheelchairAccessible"`
	IntermediateStops    []motisPlace `json:"intermediateStops"`
}

type motisItinerary struct {
	StartTime time.Time  `json:"startTime"`
	EndTime   time.Time  `json:"endTime"`
	Transfers int        `json:"transfers"`
	Legs      []motisLeg `json:"legs"`
}

type motisPlan struct {
	Direct      []motisItinerary `json:"direct"`
	Itineraries []motisItinerary `json:"itineraries"`
}

func (p *MotisProvider) Plan(ctx context.Context, req PlanRequest) ([]domain.Route, error) {
	max := req.Max
	if max <= 0 {
		max = 8
	}
	q := url.Values{}
	q.Set("fromPlace", fmt.Sprintf("%.6f,%.6f", req.Origin.Latitude, req.Origin.Longitude))
	q.Set("toPlace", fmt.Sprintf("%.6f,%.6f", req.Dest.Latitude, req.Dest.Longitude))
	q.Set("time", req.Time.UTC().Format(time.RFC3339))
	q.Set("numItineraries", fmt.Sprint(max))
	if req.ArriveBy {
		q.Set("arriveBy", "true")
	}
	if req.Prefs.RequireElevator {
		q.Set("pedestrianProfile", "WHEELCHAIR")
	}

	var plan motisPlan
	if err := p.get(ctx, "/api/v5/plan?"+q.Encode(), &plan); err != nil {
		return nil, err
	}

	// The API returns the same line pattern at several departure times. Keep
	// one itinerary per pattern (the best-timed one, which comes first for
	// depart-at and last for arrive-by) so alternatives are really different.
	all := append(plan.Direct, plan.Itineraries...)
	seen := map[string]int{}
	var routes []domain.Route
	for _, it := range all {
		if len(it.Legs) == 0 {
			continue
		}
		r := p.toRoute(it, req)
		sig := signature(r)
		if idx, dup := seen[sig]; dup {
			if req.ArriveBy && r.DepartureTime.After(routes[idx].DepartureTime) {
				routes[idx] = r
			}
			continue
		}
		seen[sig] = len(routes)
		routes = append(routes, r)
	}
	if len(routes) == 0 {
		return nil, ErrNoItineraries
	}
	return routes, nil
}

// PlanWalk returns a walking-only route between two points, leaving at `depart`.
func (p *MotisProvider) PlanWalk(ctx context.Context, origin, dest domain.Location, depart time.Time) (domain.Route, error) {
	q := url.Values{}
	q.Set("fromPlace", fmt.Sprintf("%.6f,%.6f", origin.Latitude, origin.Longitude))
	q.Set("toPlace", fmt.Sprintf("%.6f,%.6f", dest.Latitude, dest.Longitude))
	q.Set("time", depart.UTC().Format(time.RFC3339))
	q.Set("transitModes", "")
	q.Set("directModes", "WALK")
	q.Set("maxDirectTime", "5400")

	var plan motisPlan
	if err := p.get(ctx, "/api/v5/plan?"+q.Encode(), &plan); err != nil {
		return domain.Route{}, err
	}
	if len(plan.Direct) == 0 || len(plan.Direct[0].Legs) == 0 {
		return domain.Route{}, fmt.Errorf("no walking route found")
	}
	return p.toRoute(plan.Direct[0], PlanRequest{Origin: origin, Dest: dest}), nil
}

func (p *MotisProvider) get(ctx context.Context, path string, out any) error {
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, p.baseURL+path, nil)
	if err != nil {
		return err
	}
	httpReq.Header.Set("User-Agent", p.userAgent)
	resp, err := p.http.Do(httpReq)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("transit API %s: HTTP %d", p.baseURL, resp.StatusCode)
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

func signature(r domain.Route) string {
	var sb strings.Builder
	for _, n := range r.Nodes {
		if n.Mode == domain.ModeWalk {
			sb.WriteString("w|")
			continue
		}
		fmt.Fprintf(&sb, "%s:%s:%s>%s|", n.Mode, n.TransitLine, n.StationOrStopName, n.ToStopName)
	}
	return sb.String()
}

func (p *MotisProvider) toRoute(it motisItinerary, req PlanRequest) domain.Route {
	nodes := make([]domain.IntermodalNode, 0, len(it.Legs))
	for i, leg := range it.Legs {
		mode := mapMode(leg)
		fromName := placeName(leg.From, req)
		toName := placeName(leg.To, req)

		nodeType := domain.NodeTransfer
		if i == 0 {
			nodeType = domain.NodeDeparture
		} else if i == len(it.Legs)-1 {
			nodeType = domain.NodeArrival
		}

		distance := leg.Distance
		if distance == 0 && leg.LegGeometry.Points != "" {
			distance = PathMeters(DecodePolyline(leg.LegGeometry.Points, leg.LegGeometry.Precision))
		}

		n := domain.IntermodalNode{
			ID:                fmt.Sprintf("leg-%d", i),
			SequenceIndex:     i,
			NodeType:          nodeType,
			Mode:              mode,
			Location:          domain.Location{Name: fromName, Latitude: leg.From.Lat, Longitude: leg.From.Lon},
			ToLocation:        domain.Location{Name: toName, Latitude: leg.To.Lat, Longitude: leg.To.Lon},
			StationOrStopName: fromName,
			ToStopName:        toName,
			Headsign:          leg.Headsign,
			RouteColor:        leg.RouteColor,
			DepartureTime:     leg.StartTime,
			ArrivalTime:       leg.EndTime,
			DurationMinutes:   (leg.Duration + 59) / 60,
			DistanceMeters:    int(distance),
			Polyline:          leg.LegGeometry.Points,
			PolylinePrecision: leg.LegGeometry.Precision,
		}

		if mode == domain.ModeWalk || mode == domain.ModeBike {
			n.TransitLine = "Walking"
			n.VehicleAccessible = true
			if i > 0 && i < len(it.Legs)-1 {
				n.Instruction = "Change to " + toName
			} else {
				n.Instruction = "To " + toName
			}
		} else {
			n.TransitLine = lineName(leg)
			n.LineCode, n.LineName = lineCode(leg)
			n.StopCount = len(leg.IntermediateStops) + 1
			n.StopCode, n.ToStopCode = leg.From.StopCode, leg.To.StopCode
			for _, st := range leg.IntermediateStops {
				n.IntermediateStops = append(n.IntermediateStops, domain.StopVisit{
					Name: tidyName(st.Name), Code: st.StopCode, Time: st.Arrival,
				})
			}
			n.VehicleAccessible = isAccessible(leg.WheelchairAccessible)
			n.RealTime = leg.RealTime
			if leg.RealTime && !leg.ScheduledStartTime.IsZero() {
				n.DelayMinutes = int(leg.StartTime.Sub(leg.ScheduledStartTime).Round(time.Minute).Minutes())
			}
			stops := "1 stop"
			if n.StopCount != 1 {
				stops = fmt.Sprintf("%d stops", n.StopCount)
			}
			n.Instruction = fmt.Sprintf("%s to %s", stops, toName)
			if leg.Headsign != "" {
				n.Instruction = fmt.Sprintf("Toward %s, %s", tidyName(leg.Headsign), n.Instruction)
			}
		}
		nodes = append(nodes, n)
	}

	return domain.Route{
		ID:                  fmt.Sprintf("r-%d-%d-%d", it.StartTime.Unix(), it.EndTime.Unix(), len(it.Legs)),
		OriginLocation:      req.Origin,
		DestinationLocation: req.Dest,
		DepartureTime:       it.StartTime,
		ArrivalTime:         it.EndTime,
		TransferCount:       it.Transfers,
		Nodes:               nodes,
		Source:              p.Name(),
	}
}

func placeName(pl motisPlace, req PlanRequest) string {
	switch pl.Name {
	case "START":
		return req.Origin.Name
	case "END":
		return req.Dest.Name
	}
	return tidyName(pl.Name)
}

// tidyName turns the all-capitals names some feeds use ("STATION DE
// CASTELNAU") into normal case ("Station De Castelnau"). Mixed-case names
// are left alone.
func tidyName(name string) string {
	if name == "" || name != strings.ToUpper(name) || name == strings.ToLower(name) {
		return name
	}
	runes := []rune(strings.ToLower(name))
	start := true
	for i, r := range runes {
		if start && unicode.IsLetter(r) {
			runes[i] = unicode.ToUpper(r)
		}
		start = r == ' ' || r == '-' || r == '/' || r == '(' || r == '\''
	}
	return string(runes)
}

var metroLine = regexp.MustCompile(`^Ligne \d+ - (.+)$`)

// lineName is the short name a rider would say: "Métro 5 Bleue", "REM A4-A1",
// "Bus 55 Saint-Laurent".
func lineName(leg motisLeg) string {
	mode := mapMode(leg)
	label := map[domain.TransitMode]string{domain.ModeBus: "Bus", domain.ModeMetro: "Métro", domain.ModeREM: "REM"}[mode]
	if label == "" {
		label = "Train"
	}
	name := leg.RouteShortName
	long := leg.RouteLongName
	if m := metroLine.FindStringSubmatch(long); m != nil {
		long = m[1] // "Ligne 5 - Bleue" -> "Bleue"
	}
	if name == "" {
		name = long
	} else if long != "" && mode != domain.ModeREM {
		name += " " + long
	}
	return strings.TrimSpace(label + " " + name)
}

var (
	remBranch   = regexp.MustCompile(`^([A-Z]\d+)\s*-\s*(.+)$`) // headsign "A1 - Brossard"
	numberedRun = regexp.MustCompile(`^(\d+)\s*-\s*(.+)$`)      // long name "12 - Saint-Jérôme"
)

// lineCode splits a line into the code shown on signs and vehicles and the
// name that goes with it: bus "144" + "Des Pins", metro "2" + "Orange", REM
// "A1" + "Brossard" (the branch the train is heading for, since the feed
// names the whole line "A4-A1"), commuter train "12" + "Saint-Jérôme".
func lineCode(leg motisLeg) (code, name string) {
	code, name = leg.RouteShortName, leg.RouteLongName
	switch mapMode(leg) {
	case domain.ModeMetro:
		if m := metroLine.FindStringSubmatch(name); m != nil {
			name = m[1]
		}
	case domain.ModeREM:
		if m := remBranch.FindStringSubmatch(leg.Headsign); m != nil {
			return m[1], m[2]
		}
		return code, ""
	case domain.ModeTrain:
		if m := numberedRun.FindStringSubmatch(name); m != nil {
			return m[1], m[2]
		}
	}
	if code == "" { // no short name published: the long name is all there is
		return "", name
	}
	return code, name
}

func mapMode(leg motisLeg) domain.TransitMode {
	switch leg.Mode {
	case "WALK":
		return domain.ModeWalk
	case "BIKE", "RENTAL":
		return domain.ModeBike
	}
	if leg.AgencyID == "REM" || strings.Contains(strings.ToLower(leg.AgencyName), "express métropolitain") {
		return domain.ModeREM
	}
	switch leg.Mode {
	case "BUS", "COACH":
		return domain.ModeBus
	case "SUBWAY", "METRO":
		return domain.ModeMetro
	}
	return domain.ModeTrain
}

func isAccessible(v any) bool {
	switch t := v.(type) {
	case string:
		return t == "ACCESSIBLE"
	case bool:
		return t
	}
	return false
}

// Geocode resolves free text ("3480 Rue University, Montréal") to coordinates,
// biased toward Montreal.
func (p *MotisProvider) Geocode(ctx context.Context, text string) (domain.Location, error) {
	matches, err := p.Suggest(ctx, text, 1)
	if err != nil {
		return domain.Location{}, err
	}
	if len(matches) == 0 {
		return domain.Location{}, fmt.Errorf("no match for %q in the Montreal region", text)
	}
	// Keep what the user typed as the name; the match is the address.
	best := matches[0]
	best.Name = text
	return best, nil
}

// Suggest returns the places in the region that best match what has been
// typed so far (the geocoder matches fuzzily and on prefixes, so this works
// while typing). Name is the place or street address, Address adds the city.
func (p *MotisProvider) Suggest(ctx context.Context, text string, limit int) ([]domain.Location, error) {
	q := url.Values{}
	q.Set("text", text)
	q.Set("place", fmt.Sprintf("%.4f,%.4f", serviceLat, serviceLon))
	q.Set("placeBias", "5") // weigh closeness to the service area well above text similarity
	var results []struct {
		Type        string  `json:"type"` // ADDRESS, PLACE or STOP
		Name        string  `json:"name"`
		Lat         float64 `json:"lat"`
		Lon         float64 `json:"lon"`
		Street      string  `json:"street"`
		HouseNumber string  `json:"houseNumber"`
		Areas       []struct {
			Name    string `json:"name"`
			Default bool   `json:"default"` // the area to show: the municipality
		} `json:"areas"`
	}
	if err := p.get(ctx, "/api/v1/geocode?"+q.Encode(), &results); err != nil {
		return nil, err
	}
	// The geocoder is worldwide and ranks by name first, so a misspelt
	// "McGill" can match a building in Texas. A place the transit network
	// cannot reach is not a usable answer: keep the matches in the region.
	out := []domain.Location{}
	seen := map[string]bool{}
	for _, r := range results {
		if len(out) >= limit {
			break
		}
		if HaversineMeters(serviceLat, serviceLon, r.Lat, r.Lon) > serviceRadiusMeters {
			continue
		}
		name := r.Name
		if r.Type == "ADDRESS" && r.Street != "" && r.HouseNumber != "" {
			name = r.HouseNumber + " " + r.Street // as addresses are written here
		} else if r.Type == "STOP" {
			name = tidyName(name)
		}
		address := name
		for _, area := range r.Areas {
			if area.Default && area.Name != "" && !strings.Contains(name, area.Name) {
				address = name + ", " + area.Name
			}
		}
		if seen[address] {
			continue
		}
		seen[address] = true
		out = append(out, domain.Location{Name: name, Address: address, Latitude: r.Lat, Longitude: r.Lon})
	}
	return out, nil
}

// The region the app plans trips in: greater Montreal and the commuter-rail
// catchment around it.
const (
	serviceLat          = 45.5019
	serviceLon          = -73.5674
	serviceRadiusMeters = 150_000
)
