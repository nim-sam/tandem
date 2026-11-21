package domain

// DailyHealthSummary is the day's step count, measured by the phone's pedometer.
type DailyHealthSummary struct {
	Date                string  `json:"date"`
	Connected           bool    `json:"connected"` // the phone has reported steps for this day
	TotalStepsToday     int     `json:"total_steps_today"`
	CommuteWalkingSteps int     `json:"commute_walking_steps"`
	StepGoal            int     `json:"step_goal"`
	GoalAchievedRatio   float64 `json:"goal_achieved_ratio"`
}
