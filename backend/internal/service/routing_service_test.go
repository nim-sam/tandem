package service

import (
	"context"
	"testing"
	"time"

	"github.com/nim-sam/codejam16/backend/internal/adapter/places"
	"github.com/nim-sam/codejam16/backend/internal/adapter/repository"
	"github.com/nim-sam/codejam16/backend/internal/adapter/transit"
	"github.com/nim-sam/codejam16/backend/internal/domain"
)

// stubProvider returns a fast bus trip and a slower metro trip.
type stubProvider struct{ calls int }

func (p *stubProvider) Name() string { return "stub" }

func (p *stubProvider) Plan(ctx context.Context, req transit.PlanRequest) ([]domain.Route, error) {
	p.calls++
	mk := func(id string, mode domain.TransitMode, line string, minutes int) domain.Route {
		dep := req.Time.Add(-time.Duration(minutes) * time.Minute)
		return domain.Route{
			ID: id, DepartureTime: dep, ArrivalTime: req.Time, Source: "stub",
			Nodes: []domain.IntermodalNode{{
				Mode: mode, TransitLine: line, StationOrStopName: "McGill", ToStopName: "Berri-UQAM",
				DurationMinutes: minutes, DistanceMeters: 4000, VehicleAccessible: true,
				DepartureTime: dep, ArrivalTime: req.Time,
			}},
		}
	}
	return []domain.Route{mk("bus", domain.ModeBus, "Bus 24", 20), mk("metro", domain.ModeMetro, "Metro 1", 26)}, nil
}

func newTestService(p transit.Provider) (*RoutingService, *repository.MemoryRepository) {
	repo := repository.NewMemoryRepository()
	for _, e := range repo.GetEvents() {
		repo.DeleteEvent(e.ID)
	}
	day := time.Date(2026, 11, 23, 0, 0, 0, 0, time.Local)
	repo.SaveEvent(domain.Event{ID: "a", Title: "A", Location: domain.Location{Name: "A", Latitude: 45.50, Longitude: -73.57},
		StartTime: day.Add(9 * time.Hour), EndTime: day.Add(10 * time.Hour)})
	repo.SaveEvent(domain.Event{ID: "b", Title: "B", Location: domain.Location{Name: "B", Latitude: 45.53, Longitude: -73.61},
		StartTime: day.Add(12 * time.Hour), EndTime: day.Add(13 * time.Hour)})
	repo.SaveEvent(domain.Event{ID: "other-day", Title: "C", Location: domain.Location{Name: "C", Latitude: 45.45, Longitude: -73.44},
		StartTime: day.Add(40 * time.Hour), EndTime: day.Add(41 * time.Hour)})
	// Ranker with no agent URL: always the preferences-only fallback.
	svc := NewRoutingService(p, nil, repo, places.NewThirdPlaceCatalog(), places.NewGreenSpaceIndex(), transit.NewAccessibilityRegistry(), NewRanker(""))
	return svc, repo
}

func TestDayScheduleRanksByPreferencesAndCaches(t *testing.T) {
	stub := &stubProvider{}
	svc, repo := newTestService(stub)
	day := time.Date(2026, 11, 23, 0, 0, 0, 0, time.Local)

	sched, err := svc.GetDaySchedule(context.Background(), "default_user", day, nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(sched.Events) != 2 || len(sched.Commutes) != 1 {
		t.Fatalf("want 2 events / 1 commute for the day, got %d / %d", len(sched.Events), len(sched.Commutes))
	}
	c := sched.Commutes[0]
	// Default prefs rank metro above bus, which outweighs the bus being 6 min faster.
	if c.ID != "metro" || len(c.Alternatives) != 1 || c.RankedBy != "preferences" {
		t.Errorf("default prefs should pick metro with 1 alternative, got %s (%d alts, %s)", c.ID, len(c.Alternatives), c.RankedBy)
	}
	// planned to arrive 10 min (default buffer) before the event; 26 min ride
	if want := day.Add(11*time.Hour + 24*time.Minute); !c.DepartureTime.Equal(want) {
		t.Errorf("time to leave = %v, want %v", c.DepartureTime, want)
	}
	if c.SlackMinutes != 84 || c.IsTight {
		t.Errorf("slack = %d tight = %v, want 84 / false", c.SlackMinutes, c.IsTight)
	}
	if c.CO2SavedGrams <= 0 || c.Reason == "" {
		t.Errorf("route not enriched: co2 saved %v, reason %q", c.CO2SavedGrams, c.Reason)
	}

	// Avoiding the metro flips the choice without another provider call.
	prefs := repo.GetUserPreferences("default_user")
	prefs.AvoidedModes = []domain.TransitMode{domain.ModeMetro}
	repo.SaveUserPreferences(prefs)
	sched, _ = svc.GetDaySchedule(context.Background(), "default_user", day, nil)
	if got := sched.Commutes[0].ID; got != "bus" {
		t.Errorf("with the metro avoided want bus, got %s", got)
	}
	if stub.calls != 1 {
		t.Errorf("provider called %d times, want 1 (cached)", stub.calls)
	}
}

func TestSelectRoutePinsChoice(t *testing.T) {
	svc, _ := newTestService(&stubProvider{})
	day := time.Date(2026, 11, 23, 0, 0, 0, 0, time.Local)
	ctx := context.Background()

	sched, _ := svc.GetDaySchedule(ctx, "default_user", day, nil)
	alt := sched.Commutes[0].Alternatives[0]
	if err := svc.SelectRoute(ctx, alt.ID); err != nil {
		t.Fatal(err)
	}
	sched, _ = svc.GetDaySchedule(ctx, "default_user", day, nil)
	if got := sched.Commutes[0].ID; got != alt.ID {
		t.Errorf("selected alternative should now be the main route, got %s", got)
	}
	if err := svc.SelectRoute(ctx, "nope"); err == nil {
		t.Error("selecting an unknown route should fail")
	}
}

func TestMockFallbackWhenProviderFails(t *testing.T) {
	svc, _ := newTestService(failingProvider{})
	svc.fallback = transit.NewMockProvider(transit.NewAccessibilityRegistry())
	day := time.Date(2026, 11, 23, 0, 0, 0, 0, time.Local)
	sched, _ := svc.GetDaySchedule(context.Background(), "default_user", day, nil)
	if len(sched.Commutes) != 1 || sched.Commutes[0].Source != "mock" {
		t.Fatalf("want one commute labelled mock, got %+v", sched.Commutes)
	}
}

type failingProvider struct{}

func (failingProvider) Name() string { return "down" }
func (failingProvider) Plan(context.Context, transit.PlanRequest) ([]domain.Route, error) {
	return nil, context.DeadlineExceeded
}

// walkingProvider can also route walks, so the park candidate is available.
type walkingProvider struct {
	stubProvider
	walks int
}

func (p *walkingProvider) PlanWalk(ctx context.Context, o, d domain.Location, depart time.Time) (domain.Route, error) {
	p.walks++
	return domain.Route{DepartureTime: depart, ArrivalTime: depart.Add(12 * time.Minute), Nodes: []domain.IntermodalNode{{
		Mode: domain.ModeWalk, StationOrStopName: o.Name, ToStopName: d.Name, DurationMinutes: 12, DistanceMeters: 900,
	}}}, nil
}

type fixedWeather struct{ w domain.Weather }

func (f fixedWeather) At(context.Context, float64, float64, time.Time) (domain.Weather, error) {
	return f.w, nil
}

func TestParkWalkHomeCommuteAndWeather(t *testing.T) {
	p := &walkingProvider{}
	svc, repo := newTestService(p)
	day := time.Date(2026, 11, 23, 0, 0, 0, 0, time.Local)
	ctx := context.Background()

	// Two events ~1.3 km apart on either side of Parc La Fontaine, plus a home.
	for _, e := range repo.GetEvents() {
		repo.DeleteEvent(e.ID)
	}
	repo.SaveEvent(domain.Event{ID: "a", Title: "A", Location: domain.Location{Name: "A", Latitude: 45.5255, Longitude: -73.5755},
		StartTime: day.Add(9 * time.Hour), EndTime: day.Add(10 * time.Hour)})
	repo.SaveEvent(domain.Event{ID: "b", Title: "B", Location: domain.Location{Name: "B", Latitude: 45.5270, Longitude: -73.5630},
		StartTime: day.Add(12 * time.Hour), EndTime: day.Add(13 * time.Hour)})
	prefs := repo.GetUserPreferences("default_user")
	prefs.HomeLocation = &domain.Location{Name: "Home", Latitude: 45.50, Longitude: -73.60}
	repo.SaveUserPreferences(prefs)

	sched, err := svc.GetDaySchedule(ctx, "default_user", day, nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(sched.Commutes) != 2 || sched.Commutes[0].OriginEventID != "home" || sched.Commutes[0].DestinationEventID != "a" {
		t.Fatalf("want home->A then A->B, got %d commutes", len(sched.Commutes))
	}
	var park *domain.Route
	for _, r := range append([]domain.Route{sched.Commutes[1]}, sched.Commutes[1].Alternatives...) {
		if r.IsParkWalk {
			r := r
			park = &r
		}
	}
	if park == nil {
		t.Fatal("nature mode should offer a walk through the park for a short trip")
	}
	if len(park.Nodes) != 2 || park.TotalDurationMinutes != 24 || !park.ArrivalTime.Equal(day.Add(11*time.Hour+50*time.Minute)) {
		t.Errorf("park walk = %d legs, %d min, arrives %v", len(park.Nodes), park.TotalDurationMinutes, park.ArrivalTime)
	}
	if got := repo.GetDayStats("2026-11-23"); got.CommuteMinutes == 0 || got.PlannedSteps == 0 {
		t.Errorf("day stats not recorded: %+v", got)
	}
	walks := p.walks

	// Rain: no park candidate, only indoor suggestions, no extra walk requests.
	svc.SetForecaster(fixedWeather{domain.Weather{Summary: "Rain likely, 4°C", GoodForOutdoors: false}})
	sched, _ = svc.GetDaySchedule(ctx, "default_user", day, nil)
	c := sched.Commutes[1]
	for _, r := range append([]domain.Route{c}, c.Alternatives...) {
		if r.IsParkWalk {
			t.Error("no park walk should be offered in the rain")
		}
	}
	if c.Weather == nil || c.Weather.GoodForOutdoors {
		t.Error("weather not attached to the commute")
	}
	for _, tp := range c.SuggestedThirdPlaces {
		if tp.Type == "park" {
			t.Errorf("park %q suggested in the rain", tp.Name)
		}
	}
	if len(c.SuggestedThirdPlaces) == 0 {
		t.Error("indoor third places should still be suggested")
	}
	if p.walks != walks {
		t.Error("walk requests should be cached")
	}
}
