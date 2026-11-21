package service

import (
	"context"
	"time"

	"github.com/nim-sam/codejam16/backend/internal/adapter/notification"
	"github.com/nim-sam/codejam16/backend/internal/domain"
)

// NotificationService answers "when do I have to leave next?".
//
// It reuses the commutes from the day schedule, so the alert always matches the
// route the user sees. Delivery is the app's job: it schedules a LOCAL
// notification (expo-notifications) for RecommendedLeaveTime, so no push
// server or device tokens are needed.
type NotificationService struct {
	routing   *RoutingService
	formatter *notification.PushSender
}

func NewNotificationService(routing *RoutingService, formatter *notification.PushSender) *NotificationService {
	return &NotificationService{routing: routing, formatter: formatter}
}

// GetNextDepartureAlert returns the alert for the next commute that has not departed yet, or nil.
func (s *NotificationService) GetNextDepartureAlert(ctx context.Context, userID string) (*domain.TimeToLeaveAlert, error) {
	now := time.Now()
	schedule, err := s.routing.GetDaySchedule(ctx, userID, now, nil)
	if err != nil {
		return nil, err
	}
	events := map[string]domain.Event{}
	for _, e := range schedule.Events {
		events[e.ID] = e
	}
	for _, commute := range schedule.Commutes {
		if commute.DepartureTime.Before(now) {
			continue
		}
		next, ok := events[commute.DestinationEventID]
		if !ok {
			// The trip back to where the day ends (home) is not to an event.
			next = domain.Event{ID: commute.DestinationEventID, Title: commute.DestinationLocation.Name,
				Location: commute.DestinationLocation, StartTime: commute.ArrivalTime}
		}
		alert := s.formatter.GenerateTimeToLeaveAlert(next, commute)
		return &alert, nil
	}
	return nil, nil
}
