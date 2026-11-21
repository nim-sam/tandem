package domain

// UserPreferences controls routing criteria, mode prioritization, and accessibility.
type UserPreferences struct {
	UserID                 string        `json:"user_id"`
	PrioritizedModes       []TransitMode `json:"prioritized_modes"`        // e.g. [ModeWalk, ModeMetro, ModeREM]
	AvoidedModes           []TransitMode `json:"avoided_modes"`            // e.g. [ModeBus]
	RequireElevator        bool          `json:"require_elevator"`         // Must have elevator access (Metro / REM)
	PreferNatureRoutes     bool          `json:"prefer_nature_routes"`     // "Touch Grass" mode enabled
	MaxWalkingMinutes      int           `json:"max_walking_minutes"`      // Max preferred walking time
	DepartureBufferMinutes int           `json:"departure_buffer_minutes"` // Minutes to leave early
	AllowThirdPlaceDetours bool          `json:"allow_third_place_detours"`
	StepGoalDaily          int           `json:"step_goal_daily"`
	// HomeLocation, when set, is where the first commute of the day starts.
	HomeLocation *Location `json:"home_location,omitempty"`
	// HealthProvider is where step counts come from: "phone" (the phone's
	// pedometer, real data), or "fitbit" / "garmin" (simulated for now).
	HealthProvider HealthProvider `json:"health_provider"`
	// Appearance is the app theme: "light" (default), "dark", or "system".
	Appearance string `json:"appearance"`
}

// DefaultUserPreferences returns a balanced default configuration.
func DefaultUserPreferences(userID string) UserPreferences {
	return UserPreferences{
		UserID:                 userID,
		PrioritizedModes:       []TransitMode{ModeWalk, ModeMetro, ModeREM, ModeBus},
		AvoidedModes:           []TransitMode{},
		RequireElevator:        false,
		PreferNatureRoutes:     true,
		MaxWalkingMinutes:      25,
		DepartureBufferMinutes: 10,
		AllowThirdPlaceDetours: true,
		StepGoalDaily:          8000,
		HealthProvider:         ProviderPhone,
		Appearance:             "light",
	}
}
