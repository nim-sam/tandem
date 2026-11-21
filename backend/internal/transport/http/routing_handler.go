package http

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/nim-sam/codejam16/backend/internal/domain"
)

func (s *Server) handleGetDaySchedule(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		userID = "default_user"
	}

	var natureOverride *bool
	if natureParam := r.URL.Query().Get("nature"); natureParam != "" {
		val, err := strconv.ParseBool(natureParam)
		if err == nil {
			natureOverride = &val
		}
	}

	date := time.Now()
	if d := r.URL.Query().Get("date"); d != "" {
		parsed, err := time.ParseInLocation("2006-01-02", d, time.Local)
		if err != nil {
			respondError(w, http.StatusBadRequest, "date must be YYYY-MM-DD")
			return
		}
		date = parsed
	}

	schedule, err := s.routingService.GetDaySchedule(r.Context(), userID, date, natureOverride)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, schedule)
}

type PlanRouteRequest struct {
	Origin        domain.Location `json:"origin"`
	Destination   domain.Location `json:"destination"`
	NatureFocused bool            `json:"nature_focused"`
}

func (s *Server) handlePlanRoute(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		userID = "default_user"
	}

	var req PlanRouteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid route plan request")
		return
	}

	route, err := s.routingService.PlanCustomRoute(r.Context(), userID, req.Origin, req.Destination, req.NatureFocused)
	if err != nil {
		respondError(w, http.StatusBadGateway, "No route found: "+err.Error())
		return
	}
	eco := s.ecoService.CalculateCO2Savings(r.Context(), route)

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"route": route,
		"eco":   eco,
	})
}

// handleSelectRoute records that the user picked one of the alternatives.
// It pins that option for the commute and trains the ML ranker.
func (s *Server) handleSelectRoute(w http.ResponseWriter, r *http.Request) {
	var req struct {
		RouteID string `json:"route_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.RouteID == "" {
		respondError(w, http.StatusBadRequest, "route_id is required")
		return
	}
	if err := s.routingService.SelectRoute(r.Context(), req.RouteID); err != nil {
		respondError(w, http.StatusNotFound, err.Error())
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "selected", "route_id": req.RouteID})
}

// handleGeocode resolves ?q=address to coordinates (for the add-event form).
func (s *Server) handleGeocode(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	if q == "" {
		respondError(w, http.StatusBadRequest, "q is required")
		return
	}
	loc, err := s.calendarService.Geocode(r.Context(), q)
	if err != nil {
		respondError(w, http.StatusNotFound, err.Error())
		return
	}
	respondJSON(w, http.StatusOK, loc)
}
