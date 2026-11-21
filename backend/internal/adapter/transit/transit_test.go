package transit

import (
	"context"
	"encoding/json"
	"math"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/nim-sam/codejam16/backend/internal/domain"
)

func TestDecodePolyline(t *testing.T) {
	// Reference example from Google's polyline documentation.
	pts := DecodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@", 5)
	want := []Point{{38.5, -120.2}, {40.7, -120.95}, {43.252, -126.453}}
	if len(pts) != len(want) {
		t.Fatalf("got %d points, want %d", len(pts), len(want))
	}
	for i := range want {
		if math.Abs(pts[i].Lat-want[i].Lat) > 1e-5 || math.Abs(pts[i].Lon-want[i].Lon) > 1e-5 {
			t.Errorf("point %d = %+v, want %+v", i, pts[i], want[i])
		}
	}
}

func TestStationNameNormalization(t *testing.T) {
	reg := NewAccessibilityRegistry()
	for _, name := range []string{"McGill", "STATION MCGILL", "Station McGill", "McGill Metro"} {
		if !reg.HasWorkingElevator(name) {
			t.Errorf("%q should match the McGill entry", name)
		}
	}
	if reg.HasWorkingElevator("STATION DE CASTELNAU") {
		t.Error("De Castelnau is not in the elevator list")
	}
}

func TestMotisProviderMapsLegsAndDeduplicates(t *testing.T) {
	leg := func(mode, from, to, agency, short string, start, end time.Time) map[string]any {
		return map[string]any{
			"mode": mode, "from": map[string]any{"name": from, "lat": 45.5, "lon": -73.57},
			"to":       map[string]any{"name": to, "lat": 45.45, "lon": -73.44},
			"duration": int(end.Sub(start).Seconds()), "startTime": start, "endTime": end,
			"agencyId": agency, "routeShortName": short, "wheelchairAccessible": "ACCESSIBLE",
			"distance": 400.0, "legGeometry": map[string]any{"points": "", "precision": 6},
		}
	}
	itinerary := func(start time.Time) map[string]any {
		return map[string]any{
			"startTime": start, "endTime": start.Add(30 * time.Minute), "transfers": 0,
			"legs": []any{
				leg("WALK", "START", "Station McGill", "", "", start, start.Add(5*time.Minute)),
				leg("TRAM", "Station McGill", "Station Du Quartier", "REM", "A1", start.Add(5*time.Minute), start.Add(25*time.Minute)),
				leg("WALK", "Station Du Quartier", "END", "", "", start.Add(25*time.Minute), start.Add(30*time.Minute)),
			},
		}
	}
	t0 := time.Date(2026, 11, 21, 14, 0, 0, 0, time.UTC)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("User-Agent") != "test-agent" {
			t.Errorf("User-Agent not forwarded: %q", r.Header.Get("User-Agent"))
		}
		if r.URL.Query().Get("arriveBy") != "true" {
			t.Errorf("arriveBy not set: %s", r.URL.RawQuery)
		}
		// same line pattern at two departure times -> one candidate
		_ = json.NewEncoder(w).Encode(map[string]any{"itineraries": []any{itinerary(t0), itinerary(t0.Add(10 * time.Minute))}})
	}))
	defer srv.Close()

	routes, err := NewMotisProvider(srv.URL, "test-agent").Plan(context.Background(), PlanRequest{
		Origin: domain.Location{Name: "Campus", Latitude: 45.5, Longitude: -73.57},
		Dest:   domain.Location{Name: "Office", Latitude: 45.45, Longitude: -73.44},
		Time:   t0.Add(time.Hour), ArriveBy: true,
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(routes) != 1 {
		t.Fatalf("got %d routes, want 1 after de-duplication", len(routes))
	}
	r := routes[0]
	if !r.DepartureTime.Equal(t0.Add(10 * time.Minute)) {
		t.Errorf("arrive-by should keep the latest departure, got %v", r.DepartureTime)
	}
	if got := r.Nodes[1].Mode; got != domain.ModeREM {
		t.Errorf("REM leg mapped to %q", got)
	}
	if r.Nodes[0].StationOrStopName != "Campus" || r.Nodes[2].ToStopName != "Office" {
		t.Errorf("START/END not replaced with place names: %q, %q", r.Nodes[0].StationOrStopName, r.Nodes[2].ToStopName)
	}
	if !r.Nodes[1].VehicleAccessible {
		t.Error("accessible trip not flagged")
	}
	if got := r.Nodes[1].Instruction; got != "5 stops to Station Du Quartier" && got != "1 stop to Station Du Quartier" {
		t.Errorf("instruction = %q", got)
	}
}

func TestNamesAreTidied(t *testing.T) {
	if got := tidyName("STATION ÉDOUARD-MONTPETIT"); got != "Station Édouard-Montpetit" {
		t.Errorf("tidyName = %q", got)
	}
	if got := tidyName("Station McGill"); got != "Station McGill" {
		t.Errorf("mixed case must be left alone, got %q", got)
	}
	leg := motisLeg{Mode: "SUBWAY", RouteShortName: "5", RouteLongName: "Ligne 5 - Bleue"}
	if got := lineName(leg); got != "Métro 5 Bleue" {
		t.Errorf("lineName = %q", got)
	}
}
