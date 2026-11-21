package repository

import (
	"path/filepath"
	"testing"
	"time"

	"github.com/nim-sam/tandem/backend/internal/domain"
)

func TestPersistenceAndCollections(t *testing.T) {
	path := filepath.Join(t.TempDir(), "sub", "app.db")
	repo, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	if len(repo.GetEvents()) != 0 || len(repo.GetCollections()) != 0 {
		t.Fatal("a new database must be empty: no demo data")
	}

	now := time.Now()
	repo.SaveEvent(domain.Event{ID: "mine", Title: "Mine", StartTime: now, EndTime: now.Add(time.Hour)})
	repo.SaveEvents([]domain.Event{
		{ID: "later", Title: "Later", StartTime: now.Add(48 * time.Hour), EndTime: now.Add(49 * time.Hour)},
		{ID: "mine", Title: "Mine, renamed", StartTime: now, EndTime: now.Add(time.Hour)},
	})
	prefs := repo.GetUserPreferences("default_user")
	prefs.HomeLocation = &domain.Location{Name: "Home", Latitude: 45.52, Longitude: -73.58}
	repo.SaveUserPreferences(prefs)
	repo.UpdateDayStats("2026-11-20", func(st *domain.DayStats) { st.ReportedSteps = 4200 })
	repo.SaveDayEndpoint("2026-11-20", "origin", domain.DayEndpoint{Location: domain.Location{Name: "Hotel", Latitude: 45.5, Longitude: -73.6}})
	repo.SaveRoutes("k", now, []domain.Route{{ID: "r1", Nodes: []domain.IntermodalNode{{Mode: domain.ModeBus}}}})
	repo.SaveRouteChoice("a>b", "bus:24|")

	repo.SaveCollection(domain.Collection{ID: "grass", Name: "Parks", CreatedAt: now})
	repo.SaveCollection(domain.Collection{ID: "third", Name: "Cafes", CreatedAt: now.Add(time.Second)})
	for _, p := range []struct{ col, id string }{{"grass", "sp-1"}, {"grass", "sp-2"}, {"third", "sp-3"}, {"third", "sp-4"}} {
		if !repo.AddPlaceToCollection(p.col, domain.SavedPlace{ID: p.id, Name: p.id}) {
			t.Fatal("add place failed")
		}
	}
	if !repo.MovePlace("grass", "sp-1", "third") {
		t.Fatal("move failed")
	}
	if _, ok := repo.RemovePlace("third", "sp-3"); !ok {
		t.Fatal("remove failed")
	}
	if repo.MovePlace("grass", "nope", "third") || repo.AddPlaceToCollection("nope", domain.SavedPlace{ID: "x"}) {
		t.Error("moving a missing place or adding to a missing collection should fail")
	}
	if err := repo.Close(); err != nil {
		t.Fatal(err)
	}

	// Reopen: everything is still there.
	again, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	if got := again.GetEvents(); len(got) != 2 || got[0].Title != "Mine, renamed" {
		t.Errorf("events after reopen: %+v", got)
	}
	if got := again.GetEventsBetween(now.Add(-time.Hour), now.Add(time.Hour)); len(got) != 1 || got[0].ID != "mine" {
		t.Errorf("events in range: %+v", got)
	}
	if h := again.GetUserPreferences("default_user").HomeLocation; h == nil || h.Name != "Home" {
		t.Errorf("home not persisted: %+v", h)
	}
	if again.GetDayStats("2026-11-20").ReportedSteps != 4200 {
		t.Error("steps not persisted")
	}
	if ep, ok := again.GetDayEndpoint("2026-11-20", "origin"); !ok || ep.Location.Name != "Hotel" {
		t.Errorf("day endpoint not persisted: %+v", ep)
	}
	if _, ok := again.GetDayEndpoint("2026-11-20", "destination"); ok {
		t.Error("an endpoint that was never set should not exist")
	}
	if routes, at, ok := again.GetRoutes("k"); !ok || len(routes) != 1 || routes[0].Nodes[0].Mode != domain.ModeBus || time.Since(at) > time.Minute {
		t.Errorf("routes not persisted: %+v %v", routes, at)
	}
	if sig, ok := again.GetRouteChoice("a>b"); !ok || sig != "bus:24|" {
		t.Errorf("route choice not persisted: %q", sig)
	}
	cols := again.GetCollections()
	if len(cols) != 2 || cols[0].ID != "grass" || len(cols[0].Places) != 1 || len(cols[1].Places) != 2 ||
		cols[1].Places[1].ID != "sp-1" || cols[1].Places[1].CollectionID != "third" {
		t.Errorf("collections after move/remove: %+v", cols)
	}
	if !again.DeleteCollection("grass") || again.DeleteCollection("grass") {
		t.Error("delete collection should succeed once")
	}
}
