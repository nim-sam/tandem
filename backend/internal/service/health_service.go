package service

import (
	"context"
	"errors"
	"time"

	"github.com/nim-sam/tandem/backend/internal/adapter/repository"
	"github.com/nim-sam/tandem/backend/internal/domain"
)

// HealthService reports step counts: real numbers, pushed by the app from the
// phone's pedometer (ReportSteps).
type HealthService struct {
	repo *repository.Repository
}

func NewHealthService(repo *repository.Repository) *HealthService {
	return &HealthService{repo: repo}
}

func (s *HealthService) GetDailyHealth(ctx context.Context, userID, date string) (domain.DailyHealthSummary, error) {
	prefs := s.repo.GetUserPreferences(userID)
	goal := prefs.StepGoalDaily
	if goal <= 0 {
		goal = 8000
	}

	stats := s.repo.GetDayStats(date)
	return domain.DailyHealthSummary{
		Date:                date,
		Connected:           stats.ReportedSteps > 0,
		TotalStepsToday:     stats.ReportedSteps,
		CommuteWalkingSteps: stats.PlannedSteps, // planned walking in today's commutes
		StepGoal:            goal,
		GoalAchievedRatio:   float64(stats.ReportedSteps) / float64(goal),
	}, nil
}

// ReportSteps stores the step count the phone measured for a date. The phone
// sends its running total for the day, so the latest value replaces the old one.
func (s *HealthService) ReportSteps(ctx context.Context, date string, steps int) error {
	if _, err := time.Parse("2006-01-02", date); err != nil {
		return errors.New("date must be YYYY-MM-DD")
	}
	if steps < 0 || steps > 200000 {
		return errors.New("steps out of range")
	}
	s.repo.UpdateDayStats(date, func(st *domain.DayStats) { st.ReportedSteps = steps })
	return nil
}

// GetWeekStats summarises the seven days ending today.
func (s *HealthService) GetWeekStats(ctx context.Context, today time.Time) domain.WeekStats {
	week := domain.WeekStats{Days: make([]domain.DayStats, 0, 7)}
	for i := 6; i >= 0; i-- {
		st := s.repo.GetDayStats(today.AddDate(0, 0, -i).Format("2006-01-02"))
		week.Days = append(week.Days, st)
		week.TotalCO2SavedGrams += st.CO2SavedGrams
		week.TotalPlannedSteps += st.PlannedSteps
		week.TotalReportedSteps += st.ReportedSteps
	}
	week.TotalCO2SavedGrams = round2(week.TotalCO2SavedGrams)
	// Streak: consecutive days ending today. Today not counting yet does not break it.
	for i := 0; i < 365; i++ {
		st := s.repo.GetDayStats(today.AddDate(0, 0, -i).Format("2006-01-02"))
		if !st.TouchedGrass {
			if i == 0 {
				continue
			}
			break
		}
		week.TouchGrassStreak++
	}
	return week
}
