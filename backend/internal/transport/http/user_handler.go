package http

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/nim-sam/codejam16/backend/internal/domain"
)

func (s *Server) handleGetHealthSummary(w http.ResponseWriter, r *http.Request) {
	date := r.URL.Query().Get("date")
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}

	summary, err := s.healthService.GetDailyHealth(r.Context(), userID(r), date)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, summary)
}

func (s *Server) handleGetUserPreferences(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		userID = "default_user"
	}

	prefs := s.repo.GetUserPreferences(userID)
	respondJSON(w, http.StatusOK, prefs)
}

func (s *Server) handleUpdateUserPreferences(w http.ResponseWriter, r *http.Request) {
	var prefs domain.UserPreferences
	if err := json.NewDecoder(r.Body).Decode(&prefs); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid preferences payload")
		return
	}

	if prefs.UserID == "" {
		prefs.UserID = "default_user"
	}

	s.repo.SaveUserPreferences(prefs)
	respondJSON(w, http.StatusOK, prefs)
}

// handleReportSteps stores the phone pedometer's step total for a day.
// Body: {"date": "YYYY-MM-DD", "steps": 4321}
func (s *Server) handleReportSteps(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Date  string `json:"date"`
		Steps int    `json:"steps"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid steps payload")
		return
	}
	if req.Date == "" {
		req.Date = time.Now().Format("2006-01-02")
	}
	if err := s.healthService.ReportSteps(r.Context(), req.Date, req.Steps); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}
	respondJSON(w, http.StatusOK, map[string]any{"status": "recorded", "date": req.Date, "steps": req.Steps})
}

func (s *Server) handleGetWeekStats(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, s.healthService.GetWeekStats(r.Context(), time.Now()))
}

// handleGetLearnedWeights explains the ranking: the weights from the user's
// settings, the correction the ML agent has learned, and how many choices it
// has learned from.
func (s *Server) handleGetLearnedWeights(w http.ResponseWriter, r *http.Request) {
	prefs := s.repo.GetUserPreferences(userID(r))
	out := map[string]any{
		"prior_weights":   domain.PriorWeights(prefs, prefs.PreferNatureRoutes),
		"learned_delta":   domain.FeatureVector{},
		"feedback_count":  0,
		"ml_agent_online": false,
	}
	if delta, count, err := s.ranker.Learned(r.Context(), userID(r)); err == nil {
		out["learned_delta"], out["feedback_count"], out["ml_agent_online"] = delta, count, true
	}
	respondJSON(w, http.StatusOK, out)
}

func (s *Server) handleResetLearnedWeights(w http.ResponseWriter, r *http.Request) {
	if err := s.ranker.Forget(r.Context(), userID(r)); err != nil {
		respondError(w, http.StatusBadGateway, "ML agent is not reachable")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "reset"})
}
