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

func (p *MotisProvider) Name() string { return "transitous" }

type motisPlace struct {
	Name string  `json:"name"`
	Lat  float64 `json:"lat"`
	Lon  float64 `json:"lon"`
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
	Headsign             string            `json:"headsign"`
	RouteShortName       string            `json:"routeShortName"`
	RouteLongName        string            `json:"routeLongName"`
	RouteColor           string            `json:"routeColor"`
	AgencyName           string            `json:"agencyName"`
	AgencyID             string            `json:"agencyId"`
	WheelchairAccessible any               `json:"wheelchairAccessible"`
	IntermediateStops    []json.RawMessage `json:"intermediateStops"`
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
		return nil, fmt.Errorf("transit API returned no itineraries")
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
			n.StopCount = len(leg.IntermediateStops) + 1
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
	q := url.Values{}
	q.Set("text", text)
	q.Set("place", "45.5019,-73.5674")
	var results []struct {
		Name        string  `json:"name"`
		Lat         float64 `json:"lat"`
		Lon         float64 `json:"lon"`
		Street      string  `json:"street"`
		HouseNumber string  `json:"houseNumber"`
	}
	if err := p.get(ctx, "/api/v1/geocode?"+q.Encode(), &results); err != nil {
		return domain.Location{}, err
	}
	if len(results) == 0 {
		return domain.Location{}, fmt.Errorf("no geocoding match for %q", text)
	}
	r := results[0]
	return domain.Location{Name: text, Address: r.Name, Latitude: r.Lat, Longitude: r.Lon}, nil
}
