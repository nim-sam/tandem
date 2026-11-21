package domain

import "time"

// HealthProvider represents supported wearable platforms.
type HealthProvider string

const (
	ProviderPhone       HealthProvider = "phone" // phone pedometer, reported by the app
	ProviderFitbit      HealthProvider = "fitbit"
	ProviderGarmin      HealthProvider = "garmin"
	ProviderAppleHealth HealthProvider = "apple_health"
	ProviderGoogleFit   HealthProvider = "google_fit"
)

// CommuteStepRecord tracks steps accumulated during walking legs of commutes.
type CommuteStepRecord struct {
	CommuteID    string    `json:"commute_id"`
	Date         string    `json:"date"`
	StepCount    int       `json:"step_count"`
	DistanceKm   float64   `json:"distance_km"`
	CaloriesBurn int       `json:"calories_burned"`
	DurationMins int       `json:"duration_mins"`
	RecordedAt   time.Time `json:"recorded_at"`
}

// DailyHealthSummary aggregates wearable health data.
type DailyHealthSummary struct {
	Date                string              `json:"date"`
	Provider            HealthProvider      `json:"provider"`
	Connected           bool                `json:"connected"`
	Simulated           bool                `json:"simulated"` // true: numbers are placeholders, not from a device
	TotalStepsToday     int                 `json:"total_steps_today"`
	CommuteWalkingSteps int                 `json:"commute_walking_steps"`
	StepGoal            int                 `json:"step_goal"`
	GoalAchievedRatio   float64             `json:"goal_achieved_ratio"`
	CommuteStepRecords  []CommuteStepRecord `json:"commute_step_records"`
}

// TimeToLeaveAlert encapsulates departure timing data for notifications.
type TimeToLeaveAlert struct {
	EventID              string    `json:"event_id"`
	EventTitle           string    `json:"event_title"`
	EventLocation        string    `json:"event_location"`
	EventStartTime       time.Time `json:"event_start_time"`
	RecommendedLeaveTime time.Time `json:"recommended_leave_time"`
	MinutesUntilLeave    int       `json:"minutes_until_leave"`
	FirstStepSummary     string    `json:"first_step_summary"`
	IsNatureRoute        bool      `json:"is_nature_route"`
	ThirdPlaceSuggestion string    `json:"third_place_suggestion,omitempty"`
}
