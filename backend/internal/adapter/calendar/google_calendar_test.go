package calendar_test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/nim-sam/tandem/backend/internal/adapter/calendar"
	"github.com/nim-sam/tandem/backend/internal/domain"
)

func TestGoogleCalendarAdapter(t *testing.T) {
	var deleted, patched string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer good" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		switch r.Method {
		case http.MethodGet:
			if r.URL.Query().Get("singleEvents") != "true" {
				t.Error("recurring events must be expanded by Google")
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"items": []any{
				map[string]any{"id": "a1", "summary": "Lecture", "location": "3480 Rue University",
					"start": map[string]any{"dateTime": "2026-11-23T09:00:00-05:00"}, "end": map[string]any{"dateTime": "2026-11-23T10:30:00-05:00"}},
				map[string]any{"id": "allday", "summary": "Holiday", "start": map[string]any{"date": "2026-11-23"}, "end": map[string]any{"date": "2026-11-24"}},
				map[string]any{"id": "gone", "status": "cancelled", "start": map[string]any{"dateTime": "2026-11-23T09:00:00-05:00"}, "end": map[string]any{"dateTime": "2026-11-23T10:00:00-05:00"}},
			}})
		case http.MethodPost:
			var body map[string]any
			_ = json.NewDecoder(r.Body).Decode(&body)
			if body["summary"] != "New" {
				t.Errorf("pushed summary = %v", body["summary"])
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"id": "created-1"})
		case http.MethodPatch:
			patched = r.URL.Path
		case http.MethodDelete:
			deleted = r.URL.Path
			w.WriteHeader(http.StatusNoContent)
		}
	}))
	defer srv.Close()
	g := calendar.NewGoogleCalendarAdapterAt(srv.URL)
	ctx := context.Background()
	now := time.Now()

	events, err := g.FetchEvents(ctx, "good", now, now.AddDate(0, 0, 7))
	if err != nil {
		t.Fatal(err)
	}
	if len(events) != 1 || events[0].ID != "gcal-a1" || events[0].ExternalID != "a1" || events[0].Location.Address != "3480 Rue University" {
		t.Fatalf("want only the timed, non-cancelled event, got %+v", events)
	}
	if events[0].Location.Latitude != 0 {
		t.Error("adapter must not invent coordinates")
	}

	ev := domain.Event{Title: "New", StartTime: now, EndTime: now.Add(time.Hour)}
	if id, err := g.PushEvent(ctx, "good", ev); err != nil || id != "created-1" {
		t.Errorf("push = %q, %v", id, err)
	}
	if err := g.UpdateEvent(ctx, "good", "a1", ev); err != nil || patched != "/calendars/primary/events/a1" {
		t.Errorf("update hit %q, %v", patched, err)
	}
	if err := g.DeleteEvent(ctx, "good", "a1"); err != nil || deleted != "/calendars/primary/events/a1" {
		t.Errorf("delete hit %q, %v", deleted, err)
	}
	if _, err := g.FetchEvents(ctx, "expired", now, now); !errors.Is(err, calendar.ErrGoogleAuth) {
		t.Errorf("expired token should give ErrGoogleAuth, got %v", err)
	}
}
