package transit

import (
	"context"
	"fmt"
	"time"

	"github.com/nim-sam/codejam16/backend/internal/domain"
)

// MockProvider returns a HARDCODED itinerary (walk -> metro -> REM -> bus/walk)
// regardless of origin and destination. It exists only so the app can be
// demoed without network access; routes it produces carry Source "mock" and
// must not be presented as real directions.
type MockProvider struct {
	accessibility *AccessibilityRegistry
}

func NewMockProvider(accessibility *AccessibilityRegistry) *MockProvider {
	return &MockProvider{accessibility: accessibility}
}

func (r *MockProvider) Name() string { return "mock" }

// Plan returns two canned candidates: a standard one and a longer-walk one.
func (r *MockProvider) Plan(ctx context.Context, req PlanRequest) ([]domain.Route, error) {
	var routes []domain.Route
	for i, nature := range []bool{false, true} {
		route := r.planRoute(req.Origin, req.Dest, req.Time, req.Prefs, nature)
		if req.ArriveBy {
			// Shift the canned itinerary so it ends at the requested arrival time.
			shift := req.Time.Sub(route.ArrivalTime)
			route.DepartureTime = route.DepartureTime.Add(shift)
			route.ArrivalTime = route.ArrivalTime.Add(shift)
			for j := range route.Nodes {
				route.Nodes[j].DepartureTime = route.Nodes[j].DepartureTime.Add(shift)
				route.Nodes[j].ArrivalTime = route.Nodes[j].ArrivalTime.Add(shift)
			}
		}
		route.ID = fmt.Sprintf("mock-%d-%d", route.DepartureTime.Unix(), i)
		routes = append(routes, route)
	}
	return routes, nil
}

func (r *MockProvider) planRoute(
	origin, dest domain.Location,
	departureTime time.Time,
	prefs domain.UserPreferences,
	natureFocused bool,
) domain.Route {
	var nodes []domain.IntermodalNode
	currentTime := departureTime

	// Check if user prefers walking or avoiding buses
	prefersNoBus := false
	for _, m := range prefs.AvoidedModes {
		if m == domain.ModeBus {
			prefersNoBus = true
		}
	}

	// 1. Initial Leg: Walk to transit station
	walkDuration := 7
	walkDistance := 550
	walkSteps := walkDuration * 115
	firstStation := "McGill"
	if natureFocused {
		walkDuration = 14
		walkDistance = 1100
		walkSteps = walkDuration * 115
	}

	nodes = append(nodes, domain.IntermodalNode{
		ID:                 "node-1",
		SequenceIndex:      0,
		NodeType:           domain.NodeDeparture,
		Mode:               domain.ModeWalk,
		Location:           origin,
		StationOrStopName:  fmt.Sprintf("Walk to Station %s", firstStation),
		TransitLine:        "Walking",
		Instruction:        fmt.Sprintf("Walk from %s through university greenspace to %s Station", origin.Name, firstStation),
		DepartureTime:      currentTime,
		ArrivalTime:        currentTime.Add(time.Duration(walkDuration) * time.Minute),
		DurationMinutes:    walkDuration,
		DistanceMeters:     walkDistance,
		StepCount:          walkSteps,
		ElevatorAvailable:  true,
		AccessibilityNotes: "Paved flat sidewalk, curb ramps available",
		NatureScore:        ternary(natureFocused, 0.9, 0.4),
	})
	currentTime = currentTime.Add(time.Duration(walkDuration) * time.Minute)

	// 2. Metro Leg (STM Orange / Green Line)
	metroStation := firstStation
	metroDuration := 12
	metroDistance := 3800
	metroElevator := r.accessibility.HasWorkingElevator(metroStation)

	nodes = append(nodes, domain.IntermodalNode{
		ID:                 "node-2",
		SequenceIndex:      1,
		NodeType:           domain.NodeTransfer,
		Mode:               domain.ModeMetro,
		Location:           domain.Location{Name: metroStation + " Metro", Latitude: 45.5040, Longitude: -73.5710},
		StationOrStopName:  metroStation + " Metro",
		ToStopName:         "Bonaventure",
		VehicleAccessible:  true,
		TransitLine:        "Green / Orange Line (STM)",
		Instruction:        fmt.Sprintf("Board train at %s towards Bonaventure / Gare Centrale", metroStation),
		DepartureTime:      currentTime,
		ArrivalTime:        currentTime.Add(time.Duration(metroDuration) * time.Minute),
		DurationMinutes:    metroDuration,
		DistanceMeters:     metroDistance,
		StepCount:          40, // Platform walking
		ElevatorAvailable:  metroElevator,
		AccessibilityNotes: elevatorNote("STM Metro", metroStation, metroElevator),
		NatureScore:        0.1,
	})
	currentTime = currentTime.Add(time.Duration(metroDuration) * time.Minute)

	// 3. REM Leg (Intermodal Switch at Gare Centrale)
	remDuration := 15
	remDistance := 9200
	remStation := "Gare Centrale"
	remElevator := r.accessibility.HasWorkingElevator(remStation)

	nodes = append(nodes, domain.IntermodalNode{
		ID:                 "node-3",
		SequenceIndex:      2,
		NodeType:           domain.NodeTransfer,
		Mode:               domain.ModeREM,
		Location:           domain.Location{Name: "Gare Centrale REM", Latitude: 45.4998, Longitude: -73.5670},
		StationOrStopName:  remStation,
		ToStopName:         "Du Quartier",
		VehicleAccessible:  true,
		TransitLine:        "REM Branch A (CDPQ Infra)",
		Instruction:        "Intermodal switch: Transfer to REM train towards Brossard (Platform 1)",
		DepartureTime:      currentTime,
		ArrivalTime:        currentTime.Add(time.Duration(remDuration) * time.Minute),
		DurationMinutes:    remDuration,
		DistanceMeters:     remDistance,
		StepCount:          90, // Transfer steps
		ElevatorAvailable:  remElevator,
		AccessibilityNotes: "100% Accessible: High-capacity elevators and tactile paving available",
		NatureScore:        0.3,
	})
	currentTime = currentTime.Add(time.Duration(remDuration) * time.Minute)

	// 4. Final Leg: Either Bus or Walk (depending on user preference)
	if prefersNoBus || natureFocused {
		// More walking through nature / park
		finalWalkMinutes := 11
		finalWalkDistance := 850
		nodes = append(nodes, domain.IntermodalNode{
			ID:                 "node-4",
			SequenceIndex:      3,
			NodeType:           domain.NodeArrival,
			Mode:               domain.ModeWalk,
			Location:           dest,
			StationOrStopName:  "Pedestrian Green Walkway",
			TransitLine:        "Walking Path",
			Instruction:        fmt.Sprintf("Walk via scenic park trail to destination: %s", dest.Name),
			DepartureTime:      currentTime,
			ArrivalTime:        currentTime.Add(time.Duration(finalWalkMinutes) * time.Minute),
			DurationMinutes:    finalWalkMinutes,
			DistanceMeters:     finalWalkDistance,
			StepCount:          finalWalkMinutes * 115,
			ElevatorAvailable:  true,
			AccessibilityNotes: "Step-free park trail",
			NatureScore:        0.95,
		})
		currentTime = currentTime.Add(time.Duration(finalWalkMinutes) * time.Minute)
	} else {
		// Bus connection
		busDuration := 8
		busDistance := 2100
		nodes = append(nodes, domain.IntermodalNode{
			ID:                 "node-4",
			SequenceIndex:      3,
			NodeType:           domain.NodeArrival,
			Mode:               domain.ModeBus,
			Location:           dest,
			StationOrStopName:  "RTL Bus 80 Express",
			VehicleAccessible:  true,
			TransitLine:        "Line 80 (Express Solar)",
			Instruction:        fmt.Sprintf("Take Bus 80 for 3 stops directly to %s", dest.Name),
			DepartureTime:      currentTime,
			ArrivalTime:        currentTime.Add(time.Duration(busDuration) * time.Minute),
			DurationMinutes:    busDuration,
			DistanceMeters:     busDistance,
			StepCount:          30,
			ElevatorAvailable:  true,
			AccessibilityNotes: "Low-floor bus equipped with boarding ramp",
			NatureScore:        0.2,
		})
		currentTime = currentTime.Add(time.Duration(busDuration) * time.Minute)
	}

	return domain.Route{
		OriginLocation:      origin,
		DestinationLocation: dest,
		DepartureTime:       departureTime,
		ArrivalTime:         currentTime,
		TransferCount:       len(nodes) - 2,
		Nodes:               nodes,
		Source:              r.Name(),
	}
}

func elevatorNote(system, station string, available bool) string {
	if available {
		return fmt.Sprintf("%s station %s is equipped with functional elevators", system, station)
	}
	return fmt.Sprintf("Warning: %s station %s does NOT have elevator access", system, station)
}

func ternary(cond bool, a, b float64) float64 {
	if cond {
		return a
	}
	return b
}
