package domain

import (
	"time"
)

// Location represents a geographic point with an address/name.
type Location struct {
	Name      string  `json:"name"`
	Address   string  `json:"address,omitempty"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}

// Event represents a calendar event.
type Event struct {
	ID             string    `json:"id"`
	Title          string    `json:"title"`
	Description    string    `json:"description,omitempty"`
	Location       Location  `json:"location"`
	StartTime      time.Time `json:"start_time"`
	EndTime        time.Time `json:"end_time"`
	IsExternal     bool      `json:"is_external"`
	ExternalSource string    `json:"external_source,omitempty"` // "google", "ics", etc.
	ExternalID     string    `json:"external_id,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// CalendarImportRequest handles .ics text uploads or Google sync trigger.
type CalendarImportRequest struct {
	ICSContent string `json:"ics_content,omitempty"`
	Source     string `json:"source"` // "ics" or "google"
}

// CalendarSyncResult reports the outcome of a calendar sync.
type CalendarSyncResult struct {
	Source       string    `json:"source"`
	Simulated    bool      `json:"simulated"` // true: demo events, no real account was contacted
	EventsAdded  int       `json:"events_added"`
	EventsSynced int       `json:"events_synced"`
	LastSyncAt   time.Time `json:"last_sync_at"`
}
