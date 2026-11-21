package domain

import "time"

// SavedPlace represents a user-bookmarked location (Home, Work, Third Places, etc.)
type SavedPlace struct {
	ID           string    `json:"id"`
	CollectionID string    `json:"collection_id"`
	Name         string    `json:"name"`
	Address      string    `json:"address"`
	Category     string    `json:"category"` // "home", "work", "third_place", "park", "study"
	Location     Location  `json:"location"`
	Notes        string    `json:"notes,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
}

// Collection groups saved places (e.g. "Touch Grass Spots", "Cozy Cafes", "Client Offices")
type Collection struct {
	ID          string       `json:"id"`
	Name        string       `json:"name"`
	Description string       `json:"description,omitempty"`
	Icon        string       `json:"icon,omitempty"`  // Material icon name
	Color       string       `json:"color,omitempty"` // Hex color code
	Places      []SavedPlace `json:"places"`
	CreatedAt   time.Time    `json:"created_at"`
}

// ThirdPlace represents a community or nature hub for dynamic rescheduling.
type ThirdPlace struct {
	ID            string   `json:"id"`
	Name          string   `json:"name"`
	Type          string   `json:"type"` // "park", "library", "cafe", "botanical_garden"
	Location      Location `json:"location"`
	GreenScore    float64  `json:"green_score"`    // 0.0 to 1.0
	DetourMinutes int      `json:"detour_minutes"` // Extra minutes if added as a waypoint
	Description   string   `json:"description"`
	HasWifi       bool     `json:"has_wifi"`
	HasSeating    bool     `json:"has_seating"`
}
