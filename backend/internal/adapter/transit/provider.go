package transit

import (
	"context"
	"time"

	"github.com/nim-sam/codejam16/backend/internal/domain"
)

// PlanRequest asks for candidate itineraries between two points.
type PlanRequest struct {
	Origin   domain.Location
	Dest     domain.Location
	Time     time.Time
	ArriveBy bool // true: Time is the latest arrival; false: Time is the earliest departure
	Prefs    domain.UserPreferences
	Max      int // max itineraries to ask for
}

// Provider does the pathfinding. It returns several candidate routes whose
// Nodes are filled in (mode, stops, times, distance, geometry). Totals, CO2,
// nature and accessibility are computed afterwards by the routing service, and
// the ranker decides the order.
type Provider interface {
	Name() string
	Plan(ctx context.Context, req PlanRequest) ([]domain.Route, error)
}

// WalkPlanner is implemented by providers that can route a walk between two
// points. It is used to build "walk through the park" candidates.
type WalkPlanner interface {
	PlanWalk(ctx context.Context, origin, dest domain.Location, depart time.Time) (domain.Route, error)
}
