package domain

import (
	"time"
)

// TransitMode defines available modes of transportation.
type TransitMode string

const (
	ModeWalk  TransitMode = "walk"
	ModeBus   TransitMode = "bus"
	ModeMetro TransitMode = "metro"
	ModeREM   TransitMode = "rem"
	ModeBike  TransitMode = "bike"
	ModeTrain TransitMode = "train" // commuter rail (exo)
)

// NodeType designates whether an intermodal node is departure, transfer, or arrival.
type NodeType string

const (
	NodeDeparture NodeType = "departure"
	NodeTransfer  NodeType = "transfer"
	NodeArrival   NodeType = "arrival"
)

// IntermodalNode represents a single segment or interchange in a commute.
// Examples: Walk to Metro station, switch from Metro Orange line to REM, switch from REM to Bus.
type IntermodalNode struct {
	ID                 string      `json:"id"`
	SequenceIndex      int         `json:"sequence_index"`
	NodeType           NodeType    `json:"node_type"`
	Mode               TransitMode `json:"mode"`
	Location           Location    `json:"location"`
	StationOrStopName  string      `json:"station_or_stop_name,omitempty"` // where this leg starts
	ToStopName         string      `json:"to_stop_name,omitempty"`         // where this leg ends
	ToLocation         Location    `json:"to_location"`
	Headsign           string      `json:"headsign,omitempty"`
	RouteColor         string      `json:"route_color,omitempty"` // hex without '#', from the agency's GTFS
	StopCount          int         `json:"stop_count,omitempty"`
	VehicleAccessible  bool        `json:"vehicle_accessible"`           // transit legs: vehicle/trip is wheelchair accessible
	Polyline           string      `json:"polyline,omitempty"`           // encoded polyline of the leg, for drawing on a map
	PolylinePrecision  int         `json:"polyline_precision,omitempty"` // 5 or 6
	GreenSpaces        []string    `json:"green_spaces,omitempty"`       // parks a walking leg passes through
	RealTime           bool        `json:"real_time"`                    // times include live vehicle data
	DelayMinutes       int         `json:"delay_minutes"`                // departure delay vs. schedule (when RealTime)
	TransitLine        string      `json:"transit_line,omitempty"`       // e.g. "Orange Line (STM)", "REM A (CDPQ)", "Bus 80"
	Instruction        string      `json:"instruction"`                  // e.g. "Transfer from Metro to REM at Gare Centrale"
	DepartureTime      time.Time   `json:"departure_time"`
	ArrivalTime        time.Time   `json:"arrival_time"`
	DurationMinutes    int         `json:"duration_minutes"`
	DistanceMeters     int         `json:"distance_meters"`
	StepCount          int         `json:"step_count"`         // Step count if walking
	ElevatorAvailable  bool        `json:"elevator_available"` // True if accessibility elevators are operating
	AccessibilityNotes string      `json:"accessibility_notes,omitempty"`
	NatureScore        float64     `json:"nature_score"` // 0.0 to 1.0 (closeness to parks/green space)
}

// Route represents a planned trip between two event locations.
type Route struct {
	ID                   string           `json:"id"`
	OriginEventID        string           `json:"origin_event_id,omitempty"`
	DestinationEventID   string           `json:"destination_event_id,omitempty"`
	OriginLocation       Location         `json:"origin_location"`
	DestinationLocation  Location         `json:"destination_location"`
	DepartureTime        time.Time        `json:"departure_time"`
	ArrivalTime          time.Time        `json:"arrival_time"`
	TotalDurationMinutes int              `json:"total_duration_minutes"`
	TotalDistanceMeters  int              `json:"total_distance_meters"`
	TotalSteps           int              `json:"total_steps"`
	TransferCount        int              `json:"transfer_count"`
	CO2EmissionsGrams    float64          `json:"co2_emissions_grams"`
	CO2SavedGrams        float64          `json:"co2_saved_grams"`   // Saved vs baseline car commute
	IsNatureFocused      bool             `json:"is_nature_focused"` // "Touch grass" route
	IsAccessible         bool             `json:"is_accessible"`     // Has working elevators at all transfers
	Nodes                []IntermodalNode `json:"nodes"`
	SuggestedThirdPlaces []ThirdPlace     `json:"suggested_third_places,omitempty"`

	// Where the itinerary came from: "transitous" (live schedule data) or
	// "mock" (hardcoded offline demo data). The UI should label mock routes.
	Source       string   `json:"source"`
	WalkMinutes  int      `json:"walk_minutes"`
	NatureScore  float64  `json:"nature_score"`      // 0..1, share of walking in/along green space
	SlackMinutes int      `json:"slack_minutes"`     // free time between the previous event ending and having to leave
	IsParkWalk   bool     `json:"is_park_walk"`      // walking route deliberately routed through a park
	Weather      *Weather `json:"weather,omitempty"` // forecast at departure time
	IsTight      bool     `json:"is_tight"`          // does not fit between the two events

	// Ranking. Score is weights . features; Reason is a short human
	// explanation of why this option ranked where it did.
	Score        float64       `json:"score"`
	Reason       string        `json:"reason,omitempty"`
	RankedBy     string        `json:"ranked_by,omitempty"` // "ml-agent" or "preferences"
	Features     FeatureVector `json:"features,omitempty"`
	Alternatives []Route       `json:"alternatives,omitempty"` // other candidates, best first
}

// DaySchedule combines a user's calendar events with intermodal commutes between them.
type DaySchedule struct {
	Date     string     `json:"date"` // YYYY-MM-DD
	Events   []Event    `json:"events"`
	Commutes []Route    `json:"commutes"`
	Summary  DaySummary `json:"summary"`
}

// DaySummary summarizes emissions, steps, and transit time for the day.
type DaySummary struct {
	TotalEvents          int     `json:"total_events"`
	TotalCommuteMinutes  int     `json:"total_commute_minutes"`
	TotalSteps           int     `json:"total_steps"`
	TotalCO2SavedGrams   float64 `json:"total_co2_saved_grams"`
	NatureDetourEligible bool    `json:"nature_detour_eligible"`
}

// Weather is the forecast for one place and hour.
type Weather struct {
	TemperatureC             float64 `json:"temperature_c"`
	PrecipitationProbability int     `json:"precipitation_probability"` // percent
	PrecipitationMM          float64 `json:"precipitation_mm"`
	Summary                  string  `json:"summary"`           // e.g. "Rain likely, 4°C"
	GoodForOutdoors          bool    `json:"good_for_outdoors"` // false: skip park detours
}

// DayStats is what one day's plan adds up to. These are PLANNED figures taken
// from the routes shown to the user, not a record of what they actually did;
// ReportedSteps is the only measured value (from the phone pedometer).
type DayStats struct {
	Date           string  `json:"date"`
	CommuteMinutes int     `json:"commute_minutes"`
	PlannedSteps   int     `json:"planned_steps"`
	CO2SavedGrams  float64 `json:"co2_saved_grams"`
	TouchedGrass   bool    `json:"touched_grass"` // at least one commute with a meaningfully green walk
	ReportedSteps  int     `json:"reported_steps"`
}

// WeekStats summarises the last seven days.
type WeekStats struct {
	Days               []DayStats `json:"days"` // oldest first, always 7 entries
	TotalCO2SavedGrams float64    `json:"total_co2_saved_grams"`
	TotalPlannedSteps  int        `json:"total_planned_steps"`
	TotalReportedSteps int        `json:"total_reported_steps"`
	TouchGrassStreak   int        `json:"touch_grass_streak"` // consecutive days ending today
}
