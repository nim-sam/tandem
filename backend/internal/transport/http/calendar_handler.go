package http

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/nim-sam/tandem/backend/internal/adapter/calendar"
	"github.com/nim-sam/tandem/backend/internal/service"

	"github.com/nim-sam/tandem/backend/internal/domain"
)

func (s *Server) handleGetEvents(w http.ResponseWriter, r *http.Request) {
	var from, to *time.Time
	for name, target := range map[string]**time.Time{"from": &from, "to": &to} {
		if v := r.URL.Query().Get(name); v != "" {
			t, err := time.ParseInLocation("2006-01-02", v, time.Local)
			if err != nil {
				respondError(w, http.StatusBadRequest, name+" must be YYYY-MM-DD")
				return
			}
			if name == "to" {
				t = t.AddDate(0, 0, 1) // inclusive end date
			}
			*target = &t
		}
	}
	events := s.calendarService.GetEvents(r.Context(), from, to)
	respondJSON(w, http.StatusOK, map[string]interface{}{"events": events})
}

func (s *Server) handleAddEvent(w http.ResponseWriter, r *http.Request) {
	var event domain.Event
	if err := json.NewDecoder(r.Body).Decode(&event); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid event payload")
		return
	}

	created, err := s.calendarService.AddEvent(r.Context(), event)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, created)
}

func (s *Server) handleUpdateEvent(w http.ResponseWriter, r *http.Request) {
	var event domain.Event
	if err := json.NewDecoder(r.Body).Decode(&event); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid event payload")
		return
	}
	updated, err := s.calendarService.UpdateEvent(r.Context(), r.PathValue("id"), event)
	if errors.Is(err, service.ErrNotFound) {
		respondError(w, http.StatusNotFound, "Event not found")
		return
	}
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}
	respondJSON(w, http.StatusOK, updated)
}

func (s *Server) handleDeleteEvent(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := s.calendarService.DeleteEvent(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "Event not found")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "deleted", "id": id})
}

func (s *Server) handleImportICS(w http.ResponseWriter, r *http.Request) {
	var req domain.CalendarImportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ICSContent == "" {
		respondError(w, http.StatusBadRequest, "ics_content field is required")
		return
	}

	result, err := s.calendarService.ImportICS(r.Context(), req.ICSContent)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Failed to parse ICS: "+err.Error())
		return
	}

	respondJSON(w, http.StatusOK, result)
}

// handleSyncGoogle syncs with Google Calendar. Body:
// {"access_token": "..."} from the app's Google sign-in. Without a token, and
// with none provided earlier, it answers 401.
func (s *Server) handleSyncGoogle(w http.ResponseWriter, r *http.Request) {
	var req struct {
		AccessToken string `json:"access_token"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req) // empty body: reuse the token given earlier

	result, err := s.calendarService.SyncGoogleCalendar(r.Context(), req.AccessToken)
	if errors.Is(err, calendar.ErrGoogleAuth) {
		respondError(w, http.StatusUnauthorized, err.Error())
		return
	}
	if err != nil {
		respondError(w, http.StatusBadGateway, "Google sync error: "+err.Error())
		return
	}

	respondJSON(w, http.StatusOK, result)
}
