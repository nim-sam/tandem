package service

import (
	"context"
	"errors"
	"fmt"
	"log"
	"sort"
	"sync"
	"time"

	"github.com/nim-sam/codejam16/backend/internal/adapter/calendar"
	"github.com/nim-sam/codejam16/backend/internal/adapter/repository"
	"github.com/nim-sam/codejam16/backend/internal/domain"
)

// Geocoder resolves an address or place name to coordinates.
type Geocoder interface {
	Geocode(ctx context.Context, text string) (domain.Location, error)
}

type CalendarService struct {
	repo         *repository.MemoryRepository
	googleClient *calendar.GoogleCalendarAdapter
	geocoder     Geocoder // may be nil (offline mode)

	mu          sync.Mutex
	googleToken string // access token from the app's Google sign-in; memory only
}

func NewCalendarService(repo *repository.MemoryRepository, googleClient *calendar.GoogleCalendarAdapter, geocoder Geocoder) *CalendarService {
	return &CalendarService{
		repo:         repo,
		googleClient: googleClient,
		geocoder:     geocoder,
	}
}

// Geocode exposes the geocoder to the HTTP layer (address search in the app).
func (s *CalendarService) Geocode(ctx context.Context, text string) (domain.Location, error) {
	if s.geocoder == nil {
		return domain.Location{}, errors.New("geocoding is unavailable in offline mode")
	}
	return s.geocoder.Geocode(ctx, text)
}

// resolveLocation fills in coordinates for events that only carry location
// text (every .ics import, and events typed in by hand). If it cannot be
// resolved the coordinates stay zero and the event is simply not routed.
func (s *CalendarService) resolveLocation(ctx context.Context, e *domain.Event) {
	if s.geocoder == nil || e.Location.Latitude != 0 || e.Location.Longitude != 0 {
		return
	}
	text := e.Location.Address
	if text == "" {
		text = e.Location.Name
	}
	if text == "" {
		return
	}
	loc, err := s.geocoder.Geocode(ctx, text)
	if err != nil {
		log.Printf("could not geocode %q for event %q: %v", text, e.Title, err)
		return
	}
	e.Location.Latitude, e.Location.Longitude = loc.Latitude, loc.Longitude
	if e.Location.Address == "" {
		e.Location.Address = loc.Address
	}
}

// GetEvents returns events sorted by start time. from/to (either may be nil)
// limit the result to events starting inside [from, to).
func (s *CalendarService) GetEvents(ctx context.Context, from, to *time.Time) []domain.Event {
	events := []domain.Event{}
	for _, e := range s.repo.GetEvents() {
		if (from != nil && e.StartTime.Before(*from)) || (to != nil && !e.StartTime.Before(*to)) {
			continue
		}
		events = append(events, e)
	}
	sort.Slice(events, func(i, j int) bool {
		return events[i].StartTime.Before(events[j].StartTime)
	})
	return events
}

func (s *CalendarService) token() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.googleToken
}

// GoogleConnected reports whether a Google access token has been provided.
func (s *CalendarService) GoogleConnected() bool { return s.token() != "" }

func (s *CalendarService) AddEvent(ctx context.Context, event domain.Event) (domain.Event, error) {
	if event.Title == "" {
		return domain.Event{}, errors.New("title is required")
	}
	if !event.EndTime.After(event.StartTime) {
		return domain.Event{}, errors.New("end_time must be after start_time")
	}
	if event.ID == "" {
		event.ID = fmt.Sprintf("evt-local-%d", time.Now().UnixNano())
	}
	s.resolveLocation(ctx, &event)
	event.CreatedAt = time.Now()
	event.UpdatedAt = time.Now()

	// Mirror to Google Calendar when an account is connected.
	if token := s.token(); token != "" && s.googleClient != nil {
		if id, err := s.googleClient.PushEvent(ctx, token, event); err != nil {
			log.Printf("event saved locally but not pushed to Google: %v", err)
		} else {
			event.ExternalID, event.ExternalSource = id, "google"
		}
	}
	s.repo.SaveEvent(event)
	return event, nil
}

// UpdateEvent replaces the editable fields of an event. Send latitude and
// longitude as 0 when the location text changed so it is geocoded again.
func (s *CalendarService) UpdateEvent(ctx context.Context, id string, patch domain.Event) (domain.Event, error) {
	event, ok := s.repo.GetEvent(id)
	if !ok {
		return domain.Event{}, ErrNotFound
	}
	if patch.Title == "" {
		return domain.Event{}, errors.New("title is required")
	}
	if !patch.EndTime.After(patch.StartTime) {
		return domain.Event{}, errors.New("end_time must be after start_time")
	}
	event.Title, event.Description = patch.Title, patch.Description
	event.Location = patch.Location
	event.StartTime, event.EndTime = patch.StartTime, patch.EndTime
	event.UpdatedAt = time.Now()
	s.resolveLocation(ctx, &event)

	if token := s.token(); token != "" && s.googleClient != nil && event.ExternalSource == "google" && event.ExternalID != "" {
		if err := s.googleClient.UpdateEvent(ctx, token, event.ExternalID, event); err != nil {
			log.Printf("event updated locally but not on Google: %v", err)
		}
	}
	s.repo.SaveEvent(event)
	return event, nil
}

func (s *CalendarService) DeleteEvent(ctx context.Context, id string) error {
	event, ok := s.repo.GetEvent(id)
	if !ok {
		return ErrNotFound
	}
	s.repo.DeleteEvent(id)
	if token := s.token(); token != "" && s.googleClient != nil && event.ExternalSource == "google" && event.ExternalID != "" {
		if err := s.googleClient.DeleteEvent(ctx, token, event.ExternalID); err != nil {
			log.Printf("event deleted locally but not on Google: %v", err)
		}
	}
	return nil
}

func (s *CalendarService) ImportICS(ctx context.Context, icsContent string) (domain.CalendarSyncResult, error) {
	events, err := calendar.ParseICS(icsContent)
	if err != nil {
		return domain.CalendarSyncResult{}, err
	}
	s.geocodeAll(ctx, events)
	s.repo.SaveEvents(events)

	return domain.CalendarSyncResult{
		Source:       "ics",
		EventsAdded:  len(events),
		EventsSynced: len(events),
		LastSyncAt:   time.Now(),
	}, nil
}

// geocodeAll resolves locations, looking each distinct address up only once
// (a weekly class repeated 15 times is one geocoding request, not 15).
func (s *CalendarService) geocodeAll(ctx context.Context, events []domain.Event) {
	seen := map[string]domain.Location{}
	for i := range events {
		key := events[i].Location.Address + "|" + events[i].Location.Name
		if loc, ok := seen[key]; ok {
			events[i].Location = loc
			continue
		}
		s.resolveLocation(ctx, &events[i])
		seen[key] = events[i].Location
	}
}

// SyncGoogleCalendar pulls the next 30 days (and the past 7) from Google.
// Pass the access token the app obtained from Google sign-in; it is kept in
// memory so later adds/edits/deletes are mirrored. With no token, ever, it
// loads clearly-marked demo events instead.
func (s *CalendarService) SyncGoogleCalendar(ctx context.Context, accessToken string) (domain.CalendarSyncResult, error) {
	if accessToken != "" {
		s.mu.Lock()
		s.googleToken = accessToken
		s.mu.Unlock()
	}
	token := s.token()
	if token == "" || s.googleClient == nil {
		events := calendar.DemoEvents()
		s.repo.SaveEvents(events)
		return domain.CalendarSyncResult{Source: "google-demo", Simulated: true, EventsAdded: len(events), EventsSynced: len(events), LastSyncAt: time.Now()}, nil
	}

	now := time.Now()
	events, err := s.googleClient.FetchEvents(ctx, token, now.AddDate(0, 0, -7), now.AddDate(0, 0, 30))
	if err != nil {
		if errors.Is(err, calendar.ErrGoogleAuth) {
			s.mu.Lock()
			s.googleToken = ""
			s.mu.Unlock()
		}
		return domain.CalendarSyncResult{}, err
	}

	// Keep coordinates already resolved for events we have seen before.
	added := 0
	for i := range events {
		if old, ok := s.repo.GetEvent(events[i].ID); ok {
			if old.Location.Address == events[i].Location.Address {
				events[i].Location = old.Location
			}
			events[i].CreatedAt = old.CreatedAt
		} else {
			added++
		}
	}
	s.geocodeAll(ctx, events)
	s.repo.SaveEvents(events)

	return domain.CalendarSyncResult{Source: "google", EventsAdded: added, EventsSynced: len(events), LastSyncAt: now}, nil
}

// ErrNotFound is returned when the requested item does not exist.
var ErrNotFound = errors.New("not found")
