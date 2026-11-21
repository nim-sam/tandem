package health

import (
	"context"
	"math/rand"
	"time"

	"github.com/nim-sam/codejam16/backend/internal/domain"
)

// WearableAdapter interacts with Fitbit, Garmin, or health tracker APIs.
type WearableAdapter struct {
	provider domain.HealthProvider
}

func NewWearableAdapter(provider domain.HealthProvider) *WearableAdapter {
	return &WearableAdapter{provider: provider}
}

// GetDailySummary returns synced step counts and active commute stats.
func (w *WearableAdapter) GetDailySummary(ctx context.Context, date string) (domain.DailyHealthSummary, error) {
	// Simulated connection for demo/hackathon (dynamically varies with time)
	now := time.Now()
	hour := now.Hour()
	baseSteps := 2400 + (hour * 320)
	commuteSteps := 1850

	records := []domain.CommuteStepRecord{
		{
			CommuteID:    "commute-1",
			Date:         date,
			StepCount:    950,
			DistanceKm:   0.72,
			CaloriesBurn: 48,
			DurationMins: 11,
			RecordedAt:   now.Add(-4 * time.Hour),
		},
		{
			CommuteID:    "commute-2",
			Date:         date,
			StepCount:    900,
			DistanceKm:   0.68,
			CaloriesBurn: 45,
			DurationMins: 10,
			RecordedAt:   now.Add(-1 * time.Hour),
		},
	}

	return domain.DailyHealthSummary{
		Date:                date,
		Provider:            w.provider,
		Connected:           true,
		TotalStepsToday:     baseSteps,
		CommuteWalkingSteps: commuteSteps,
		StepGoal:            8000,
		GoalAchievedRatio:   float64(baseSteps) / 8000.0,
		CommuteStepRecords:  records,
	}, nil
}

// RecordWalkingSteps increments step count when user finishes a walking commute leg.
func (w *WearableAdapter) RecordWalkingSteps(ctx context.Context, minutes int) int {
	// Average human takes ~110-120 steps per minute walking
	steps := minutes * (105 + rand.Intn(20))
	return steps
}
