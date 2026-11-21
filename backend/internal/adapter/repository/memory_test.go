package repository

import (
	"path/filepath"
	"testing"
	"time"

	"github.com/nim-sam/codejam16/backend/internal/domain"
)

func TestPersistenceAndCollections(t *testing.T) {
	path := filepath.Join(t.TempDir(), "sub", "store.json")
	repo, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	seeded := len(repo.GetEvents())
	if seeded == 0 {
		t.Fatal("a new data file should be seeded with demo data")
	}

	repo.SaveEvent(domain.Event{ID: "mine", Title: "Mine", StartTime: time.Now(), EndTime: time.Now().Add(time.Hour)})
	prefs := repo.GetUserPreferences("default_user")
	prefs.HomeLocation = &domain.Location{Name: "Home", Latitude: 45.52, Longitude: -73.58}
	repo.SaveUserPreferences(prefs)
	repo.UpdateDayStats("2026-11-20", func(st *domain.DayStats) { st.ReportedSteps = 4200 })
	if !repo.MovePlace("col-touch-grass", "sp-1", "col-third-places") {
		t.Fatal("move failed")
	}
	if _, ok := repo.RemovePlace("col-third-places", "sp-3"); !ok {
		t.Fatal("remove failed")
	}
	if repo.MovePlace("col-touch-grass", "nope", "col-third-places") {
		t.Error("moving a missing place should fail")
	}

	// Reopen: everything is still there, and demo data is not re-seeded.
	again, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	if got := len(again.GetEvents()); got != seeded+1 {
		t.Errorf("events after reopen = %d, want %d", got, seeded+1)
	}
	if h := again.GetUserPreferences("default_user").HomeLocation; h == nil || h.Name != "Home" {
		t.Errorf("home not persisted: %+v", h)
	}
	if again.GetDayStats("2026-11-20").ReportedSteps != 4200 {
		t.Error("steps not persisted")
	}
	grass, _ := again.GetCollection("col-touch-grass")
	third, _ := again.GetCollection("col-third-places")
	if len(grass.Places) != 1 || len(third.Places) != 2 || third.Places[1].ID != "sp-1" || third.Places[1].CollectionID != "col-third-places" {
		t.Errorf("collections after move/remove: %d / %d places", len(grass.Places), len(third.Places))
	}
	if !again.DeleteCollection("col-touch-grass") || again.DeleteCollection("col-touch-grass") {
		t.Error("delete collection should succeed once")
	}
}
