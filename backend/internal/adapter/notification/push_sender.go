package notification

import (
	"fmt"
	"time"

	"github.com/nim-sam/codejam16/backend/internal/domain"
)

// PushSender formats time-to-leave alerts. It does not send anything: the app
// schedules a local notification from the alert it receives.
type PushSender struct{}

func NewPushSender() *PushSender {
	return &PushSender{}
}

// GenerateTimeToLeaveAlert computes when the user must depart to catch their intermodal commute comfortably.
func (p *PushSender) GenerateTimeToLeaveAlert(
	nextEvent domain.Event,
	route domain.Route,
) domain.TimeToLeaveAlert {
	// Routes are planned to arrive before the event (buffer included), so the
	// route's own departure time is the time to leave.
	recommendedLeaveTime := route.DepartureTime
	minutesUntilLeave := int(time.Until(recommendedLeaveTime).Minutes())

	firstStep := "Begin walking to station"
	if len(route.Nodes) > 0 {
		firstStep = route.Nodes[0].Instruction
	}

	thirdPlaceTip := ""
	if route.IsNatureFocused && len(route.SuggestedThirdPlaces) > 0 {
		thirdPlaceTip = fmt.Sprintf("Take the scenic detour via %s", route.SuggestedThirdPlaces[0].Name)
	}

	return domain.TimeToLeaveAlert{
		EventID:              nextEvent.ID,
		EventTitle:           nextEvent.Title,
		EventLocation:        nextEvent.Location.Name,
		EventStartTime:       nextEvent.StartTime,
		RecommendedLeaveTime: recommendedLeaveTime,
		MinutesUntilLeave:    minutesUntilLeave,
		FirstStepSummary:     firstStep,
		IsNatureRoute:        route.IsNatureFocused,
		ThirdPlaceSuggestion: thirdPlaceTip,
	}
}
