package service

import (
	"context"
	"testing"
	"time"

	"github.com/nim-sam/tandem/backend/internal/adapter/places"
	"github.com/nim-sam/tandem/backend/internal/adapter/repository"
	"github.com/nim-sam/tandem/backend/internal/adapter/transit"
	"github.com/nim-sam/tandem/backend/internal/domain"
)

// stubProvider returns a fast bus trip and a slower metro trip.
type stubProvider struct{ calls int }

func (p *stubProvider) Name() string { return "stub" }

func (p *stubProvider) Plan(ctx context.Context, req transit.PlanRequest) ([]domain.Route, error) {
	p.calls++
	mk := func(id string, mode domain.TransitMode, line string, minutes int) domain.Route {
		dep, arr := req.Time.Add(-time.Duration(minutes)*time.Minute), req.Time
		if !req.ArriveBy {
			dep, arr = req.Time, req.Time.Add(time.Duration(minutes)*time.Minute)
		}
		return domain.Route{
			ID: id, DepartureTime: dep, ArrivalTime: arr, Source: "stub",
			Nodes: []domain.IntermodalNode{{
				Mode: mode, TransitLine: line, StationOrStopName: "McGill", ToStopName: "Berri-UQAM",
				DurationMinutes: minutes, DistanceMeters: 4000, VehicleAccessible: true,
				DepartureTime: dep, ArrivalTime: arr,
			}},
		}
	}
	return []domain.Route{mk("bus", domain.ModeBus, "Bus 24", 20), mk("metro", domain.ModeMetro, "Metro 1", 26)}, nil
}

func newTestService(p transit.Provider) (*RoutingService, *repository.Repository) {
	repo := repository.NewMemoryRepository()
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

	sched, err := svc.GetDaySchedule(context.Background(), "default_user", day)
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
	sched, _ = svc.GetDaySchedule(context.Background(), "default_user", day)
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

	sched, _ := svc.GetDaySchedule(ctx, "default_user", day)
	alt := sched.Commutes[0].Alternatives[0]
	if err := svc.SelectRoute(ctx, alt.ID); err != nil {
		t.Fatal(err)
	}
	sched, _ = svc.GetDaySchedule(ctx, "default_user", day)
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
	sched, _ := svc.GetDaySchedule(context.Background(), "default_user", day)
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

	sched, err := svc.GetDaySchedule(ctx, "default_user", day)
	if err != nil {
		t.Fatal(err)
	}
	// Home is where the day starts and ends, but it is not an event.
	if len(sched.Events) != 2 || len(sched.Commutes) != 3 ||
		sched.Commutes[0].OriginEventID != domain.DayStartID || sched.Commutes[0].DestinationEventID != "a" ||
		sched.Commutes[2].OriginEventID != "b" || sched.Commutes[2].DestinationEventID != domain.DayEndID {
		t.Fatalf("want home->A, A->B, B->home, got %d commutes", len(sched.Commutes))
	}
	if sched.Origin == nil || !sched.Origin.IsHome || sched.Destination == nil || !sched.Destination.IsHome {
		t.Fatalf("the day should start and end at home: %+v / %+v", sched.Origin, sched.Destination)
	}
	// The trip back leaves when the last event ends.
	if back := sched.Commutes[2]; back.DepartureTime.Before(day.Add(13*time.Hour)) || back.IsTight || !back.ArrivalTime.After(back.DepartureTime) {
		t.Errorf("trip home leaves %v, arrives %v, tight %v", back.DepartureTime, back.ArrivalTime, back.IsTight)
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
	sched, _ = svc.GetDaySchedule(ctx, "default_user", day)
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

func TestDayEndpointOverride(t *testing.T) {
	svc, repo := newTestService(&stubProvider{})
	day := time.Date(2026, 11, 23, 0, 0, 0, 0, time.Local)
	ctx := context.Background()

	// No home, nothing chosen: only the commute between the two events.
	sched, _ := svc.GetDaySchedule(ctx, "default_user", day)
	if sched.Origin != nil || sched.Destination != nil || len(sched.Commutes) != 1 {
		t.Fatalf("without a home there are no endpoints: %+v / %+v, %d commutes", sched.Origin, sched.Destination, len(sched.Commutes))
	}

	prefs := repo.GetUserPreferences("default_user")
	prefs.HomeLocation = &domain.Location{Name: "Home", Latitude: 45.47, Longitude: -73.60}
	repo.SaveUserPreferences(prefs)
	office := domain.DayEndpoint{Location: domain.Location{Name: "Office", Latitude: 45.51, Longitude: -73.55}, Category: "work", IsHome: true}
	if err := svc.SetDayEndpoint("2026-11-23", "destination", office); err != nil {
		t.Fatal(err)
	}
	if svc.SetDayEndpoint("2026-11-23", "sideways", office) == nil || svc.SetDayEndpoint("2026-11-23", "origin", domain.DayEndpoint{}) == nil {
		t.Error("a bad endpoint name or a location without coordinates should be refused")
	}

	sched, _ = svc.GetDaySchedule(ctx, "default_user", day)
	if sched.Origin == nil || !sched.Origin.IsHome {
		t.Errorf("origin should still be home: %+v", sched.Origin)
	}
	if d := sched.Destination; d == nil || d.IsHome || d.Category != "work" || d.Location.Name != "Office" {
		t.Errorf("destination should be the office for this day: %+v", d)
	}
	if last := sched.Commutes[len(sched.Commutes)-1]; last.DestinationEventID != domain.DayEndID || last.DestinationLocation.Name != "" && last.DestinationLocation.Name != "Office" {
		t.Errorf("last commute should go to the office: %+v", last.DestinationLocation)
	}
	// Other days are untouched, and resetting goes back to home.
	if _, dest := svc.DayEndpoints(prefs, "2026-11-24"); dest == nil || !dest.IsHome {
		t.Errorf("the next day should still end at home: %+v", dest)
	}
	svc.ResetDayEndpoint("2026-11-23", "destination")
	if _, dest := svc.DayEndpoints(prefs, "2026-11-23"); dest == nil || !dest.IsHome {
		t.Errorf("after a reset the day ends at home again: %+v", dest)
	}
}

// Routes already planned are read back from the database, even by a new
// service (a restart), and survive the provider going down.
func TestPlannedRoutesArePersisted(t *testing.T) {
	stub := &stubProvider{}
	svc, repo := newTestService(stub)
	day := time.Date(2026, 11, 23, 0, 0, 0, 0, time.Local)
	ctx := context.Background()
	first, _ := svc.GetDaySchedule(ctx, "default_user", day)
	alt := first.Commutes[0].Alternatives[0]
	if err := svc.SelectRoute(ctx, alt.ID); err != nil {
		t.Fatal(err)
	}

	restarted := NewRoutingService(stubDown{}, nil, repo, places.NewThirdPlaceCatalog(), places.NewGreenSpaceIndex(), transit.NewAccessibilityRegistry(), NewRanker(""))
	again, _ := restarted.GetDaySchedule(ctx, "default_user", day)
	if stub.calls != 1 || len(again.Commutes) != 1 {
		t.Fatalf("want the saved route without a provider call, got %d commutes after %d calls", len(again.Commutes), stub.calls)
	}
	if again.Commutes[0].ID != alt.ID {
		t.Errorf("the chosen option should survive a restart, got %s", again.Commutes[0].ID)
	}
}

// stubDown is the stub provider after it has gone offline.
type stubDown struct{ failingProvider }

func (stubDown) Name() string { return "stub" }

// hourlyProvider offers a quick trip that runs two hours off the requested
// time and a slower one that runs right on it.
type hourlyProvider struct{}

func (hourlyProvider) Name() string { return "hourly" }
func (hourlyProvider) Plan(ctx context.Context, req transit.PlanRequest) ([]domain.Route, error) {
	mk := func(id string, offset, minutes int) domain.Route {
		dep := req.Time.Add(time.Duration(offset) * time.Minute)
		if req.ArriveBy {
			dep = req.Time.Add(-time.Duration(offset+minutes) * time.Minute)
		}
		arr := dep.Add(time.Duration(minutes) * time.Minute)
		return domain.Route{ID: id, DepartureTime: dep, ArrivalTime: arr, Source: "hourly", Nodes: []domain.IntermodalNode{{
			Mode: domain.ModeBus, TransitLine: id, DurationMinutes: minutes, DistanceMeters: 9000, VehicleAccessible: true,
			DepartureTime: dep, ArrivalTime: arr}}}
	}
	return []domain.Route{mk("quick-but-2h-off", 120, 40), mk("on-time", 5, 60)}, nil
}

func TestRankingCountsWaiting(t *testing.T) {
	svc, repo := newTestService(hourlyProvider{})
	prefs := repo.GetUserPreferences("default_user")
	prefs.HomeLocation = &domain.Location{Name: "Home", Latitude: 45.59, Longitude: -73.78}
	repo.SaveUserPreferences(prefs)
	sched, _ := svc.GetDaySchedule(context.Background(), "default_user", time.Date(2026, 11, 23, 0, 0, 0, 0, time.Local))
	if len(sched.Commutes) != 3 {
		t.Fatalf("want 3 commutes, got %d", len(sched.Commutes))
	}
	for _, c := range sched.Commutes {
		if c.ID != "on-time" || c.WaitMinutes != 5 {
			t.Errorf("%s -> %s: picked %s (waits %d min); arriving two hours early or leaving two hours late should lose",
				c.OriginEventID, c.DestinationEventID, c.ID, c.WaitMinutes)
		}
	}
}

// Green routes can be switched for one commute without touching the setting.
func TestGreenRoutesPerCommute(t *testing.T) {
	svc, repo := newTestService(&stubProvider{})
	ctx := context.Background()
	day := time.Date(2026, 11, 23, 0, 0, 0, 0, time.Local)

	prefs := repo.GetUserPreferences("default_user")
	prefs.PreferNatureRoutes = false
	repo.SaveUserPreferences(prefs)

	sched, _ := svc.GetDaySchedule(ctx, "default_user", day)
	if len(sched.Commutes) != 1 || sched.Commutes[0].GreenRoutes {
		t.Fatalf("with the setting off the commute should not be green: %+v", sched.Commutes)
	}
	if err := svc.SetCommuteGreen("a", "b", true); err != nil {
		t.Fatal(err)
	}
	sched, _ = svc.GetDaySchedule(ctx, "default_user", day)
	if !sched.Commutes[0].GreenRoutes {
		t.Error("the commute switched to green should report green_routes")
	}
	if repo.GetUserPreferences("default_user").PreferNatureRoutes {
		t.Error("switching one commute must not change the user's setting")
	}
	if err := svc.SetCommuteGreen("", "b", true); err == nil {
		t.Error("a commute needs both ends")
	}
}
