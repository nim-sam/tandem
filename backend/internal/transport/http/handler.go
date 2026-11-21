package http

import (
	"encoding/json"
	"net/http"

	"github.com/nim-sam/codejam16/backend/internal/adapter/repository"
	"github.com/nim-sam/codejam16/backend/internal/service"
)

type Server struct {
	calendarService     *service.CalendarService
	routingService      *service.RoutingService
	placeService        *service.PlaceService
	healthService       *service.HealthService
	notificationService *service.NotificationService
	ecoService          *service.EcoService
	ranker              *service.Ranker
	repo                *repository.Repository
	mux                 *http.ServeMux
}

func NewServer(
	calendarService *service.CalendarService,
	routingService *service.RoutingService,
	placeService *service.PlaceService,
	healthService *service.HealthService,
	notificationService *service.NotificationService,
	ecoService *service.EcoService,
	ranker *service.Ranker,
	repo *repository.Repository,
) *Server {
	s := &Server{
		calendarService:     calendarService,
		routingService:      routingService,
		placeService:        placeService,
		healthService:       healthService,
		notificationService: notificationService,
		ecoService:          ecoService,
		ranker:              ranker,
		repo:                repo,
		mux:                 http.NewServeMux(),
	}
	s.registerRoutes()
	return s
}

func (s *Server) registerRoutes() {
	// Health check
	s.mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		respondJSON(w, http.StatusOK, map[string]any{
			"status":           "ok",
			"service":          "codejam16-backend",
			"transit_provider": s.routingService.ProviderName(),
			"ml_agent_online":  s.ranker.Available(r.Context()),
			"google_connected": s.calendarService.GoogleConnected(),
		})
	})

	// Calendar
	s.mux.HandleFunc("GET /api/calendar/events", s.handleGetEvents) // ?from=YYYY-MM-DD&to=YYYY-MM-DD
	s.mux.HandleFunc("POST /api/calendar/events", s.handleAddEvent)
	s.mux.HandleFunc("PUT /api/calendar/events/{id}", s.handleUpdateEvent)
	s.mux.HandleFunc("DELETE /api/calendar/events/{id}", s.handleDeleteEvent)
	s.mux.HandleFunc("POST /api/calendar/import-ics", s.handleImportICS)
	s.mux.HandleFunc("POST /api/calendar/sync-google", s.handleSyncGoogle)

	// Routing & Commutes
	s.mux.HandleFunc("GET /api/routes/day", s.handleGetDaySchedule)
	// Where a day starts and ends, when that is not home: which = origin | destination
	s.mux.HandleFunc("PUT /api/routes/day/{date}/{which}", s.handleSetDayEndpoint)
	s.mux.HandleFunc("DELETE /api/routes/day/{date}/{which}", s.handleResetDayEndpoint)
	s.mux.HandleFunc("POST /api/routes/plan", s.handlePlanRoute)
	s.mux.HandleFunc("POST /api/routes/select", s.handleSelectRoute)
	s.mux.HandleFunc("GET /api/geocode", s.handleGeocode)
	s.mux.HandleFunc("GET /api/geocode/suggest", s.handleSuggestPlaces) // ?q=partly typed address

	// Saved places, organised in collections
	s.mux.HandleFunc("GET /api/collections", s.handleGetCollections)
	s.mux.HandleFunc("POST /api/collections", s.handleCreateCollection)
	s.mux.HandleFunc("PUT /api/collections/{id}", s.handleUpdateCollection)
	s.mux.HandleFunc("DELETE /api/collections/{id}", s.handleDeleteCollection)
	s.mux.HandleFunc("POST /api/collections/{id}/places", s.handleAddPlaceToCollection)
	s.mux.HandleFunc("DELETE /api/collections/{id}/places/{placeId}", s.handleRemovePlace)
	s.mux.HandleFunc("POST /api/collections/{id}/places/{placeId}/move", s.handleMovePlace)
	s.mux.HandleFunc("GET /api/places/third-places", s.handleGetThirdPlaces) // ?lat=&lon=

	// Health: step counts (phone pedometer or simulated wearable) and weekly totals
	s.mux.HandleFunc("GET /api/health/summary", s.handleGetHealthSummary)
	s.mux.HandleFunc("POST /api/health/steps", s.handleReportSteps)
	s.mux.HandleFunc("GET /api/stats/week", s.handleGetWeekStats)

	// User Preferences & Time-to-Leave
	s.mux.HandleFunc("GET /api/user/preferences", s.handleGetUserPreferences)
	s.mux.HandleFunc("PUT /api/user/preferences", s.handleUpdateUserPreferences)
	s.mux.HandleFunc("GET /api/notifications/time-to-leave", s.handleGetTimeToLeaveAlert)

	// What the ranking agent has learned ("why this route")
	s.mux.HandleFunc("GET /api/ml/weights", s.handleGetLearnedWeights)
	s.mux.HandleFunc("DELETE /api/ml/weights", s.handleResetLearnedWeights)
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Enable CORS for React Native & mobile development
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	s.mux.ServeHTTP(w, r)
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func respondError(w http.ResponseWriter, status int, message string) {
	respondJSON(w, status, map[string]string{"error": message})
}

func userID(r *http.Request) string {
	if id := r.URL.Query().Get("user_id"); id != "" {
		return id
	}
	return "default_user"
}
