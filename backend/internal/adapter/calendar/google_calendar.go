package calendar

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"

	"github.com/nim-sam/tandem/backend/internal/domain"
)

// GoogleCalendarAdapter talks to the Google Calendar v3 REST API using an
// OAuth access token obtained by the mobile app (scope
// https://www.googleapis.com/auth/calendar.events). The backend never sees
// the user's password or a refresh token; when the token expires the app
// signs in again.
type GoogleCalendarAdapter struct {
	baseURL string
	http    *http.Client
}

func NewGoogleCalendarAdapter() *GoogleCalendarAdapter {
	return &GoogleCalendarAdapter{
		baseURL: "https://www.googleapis.com/calendar/v3",
		http:    &http.Client{Timeout: 10 * time.Second},
	}
}

// NewGoogleCalendarAdapterAt points the adapter at another server (tests).
func NewGoogleCalendarAdapterAt(baseURL string) *GoogleCalendarAdapter {
	a := NewGoogleCalendarAdapter()
	a.baseURL = baseURL
	return a
}

type googleTime struct {
	DateTime string `json:"dateTime,omitempty"`
	Date     string `json:"date,omitempty"` // all-day events
	TimeZone string `json:"timeZone,omitempty"`
}

type googleEvent struct {
	ID          string     `json:"id,omitempty"`
	Status      string     `json:"status,omitempty"`
	Summary     string     `json:"summary"`
	Description string     `json:"description,omitempty"`
	Location    string     `json:"location,omitempty"`
	Start       googleTime `json:"start"`
	End         googleTime `json:"end"`
}

// FetchEvents lists timed events on the primary calendar between from and to.
// Recurring events are expanded by Google; all-day and cancelled events are skipped.
func (g *GoogleCalendarAdapter) FetchEvents(ctx context.Context, token string, from, to time.Time) ([]domain.Event, error) {
	q := url.Values{}
	q.Set("timeMin", from.Format(time.RFC3339))
	q.Set("timeMax", to.Format(time.RFC3339))
	q.Set("singleEvents", "true")
	q.Set("orderBy", "startTime")
	q.Set("maxResults", "250")

	var body struct {
		Items []googleEvent `json:"items"`
	}
	if err := g.do(ctx, http.MethodGet, "/calendars/primary/events?"+q.Encode(), token, nil, &body); err != nil {
		return nil, err
	}

	now := time.Now()
	var events []domain.Event
	for _, item := range body.Items {
		if item.Status == "cancelled" || item.Start.DateTime == "" {
			continue
		}
		start, err1 := time.Parse(time.RFC3339, item.Start.DateTime)
		end, err2 := time.Parse(time.RFC3339, item.End.DateTime)
		if err1 != nil || err2 != nil {
			continue
		}
		title := item.Summary
		if title == "" {
			title = "Untitled Event"
		}
		events = append(events, domain.Event{
			ID:             "gcal-" + item.ID,
			Title:          title,
			Description:    item.Description,
			Location:       domain.Location{Name: item.Location, Address: item.Location},
			StartTime:      start,
			EndTime:        end,
			IsExternal:     true,
			ExternalSource: "google",
			ExternalID:     item.ID,
			CreatedAt:      now,
			UpdatedAt:      now,
		})
	}
	return events, nil
}

func toGoogle(event domain.Event) googleEvent {
	loc := event.Location.Address
	if loc == "" {
		loc = event.Location.Name
	}
	return googleEvent{
		Summary:     event.Title,
		Description: event.Description,
		Location:    loc,
		Start:       googleTime{DateTime: event.StartTime.Format(time.RFC3339)},
		End:         googleTime{DateTime: event.EndTime.Format(time.RFC3339)},
	}
}

// PushEvent creates the event on Google Calendar and returns its Google id.
func (g *GoogleCalendarAdapter) PushEvent(ctx context.Context, token string, event domain.Event) (string, error) {
	var created googleEvent
	if err := g.do(ctx, http.MethodPost, "/calendars/primary/events", token, toGoogle(event), &created); err != nil {
		return "", err
	}
	return created.ID, nil
}

// UpdateEvent overwrites title, description, location and times on Google Calendar.
func (g *GoogleCalendarAdapter) UpdateEvent(ctx context.Context, token, externalID string, event domain.Event) error {
	return g.do(ctx, http.MethodPatch, "/calendars/primary/events/"+url.PathEscape(externalID), token, toGoogle(event), nil)
}

// DeleteEvent removes an event from Google Calendar.
func (g *GoogleCalendarAdapter) DeleteEvent(ctx context.Context, token, externalID string) error {
	return g.do(ctx, http.MethodDelete, "/calendars/primary/events/"+url.PathEscape(externalID), token, nil, nil)
}

func (g *GoogleCalendarAdapter) do(ctx context.Context, method, path, token string, payload, out any) error {
	var body *bytes.Reader = bytes.NewReader(nil)
	if payload != nil {
		data, err := json.Marshal(payload)
		if err != nil {
			return err
		}
		body = bytes.NewReader(data)
	}
	req, err := http.NewRequestWithContext(ctx, method, g.baseURL+path, body)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := g.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusUnauthorized {
		return ErrGoogleAuth
	}
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return fmt.Errorf("google calendar %s: HTTP %d", method, resp.StatusCode)
	}
	if out == nil {
		return nil
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

// ErrGoogleAuth means the access token is missing, expired or lacks the calendar scope.
var ErrGoogleAuth = fmt.Errorf("google sign-in expired or was not granted calendar access")
