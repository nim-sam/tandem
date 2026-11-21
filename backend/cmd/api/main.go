package main

import (
	"fmt"
	"log"
	"net/http"
	_ "time/tzdata" // containers have no zoneinfo; TZ=America/Toronto must resolve

	"github.com/nim-sam/codejam16/backend/config"
	"github.com/nim-sam/codejam16/backend/internal/adapter/calendar"
	"github.com/nim-sam/codejam16/backend/internal/adapter/health"
	"github.com/nim-sam/codejam16/backend/internal/adapter/notification"
	placesAdapter "github.com/nim-sam/codejam16/backend/internal/adapter/places"
	"github.com/nim-sam/codejam16/backend/internal/adapter/repository"
	"github.com/nim-sam/codejam16/backend/internal/adapter/transit"
	"github.com/nim-sam/codejam16/backend/internal/adapter/weather"
	"github.com/nim-sam/codejam16/backend/internal/domain"
	"github.com/nim-sam/codejam16/backend/internal/service"
	httpTransport "github.com/nim-sam/codejam16/backend/internal/transport/http"
)

func main() {
	cfg := config.Load()

	// 1. Adapters
	repo, err := repository.Open(cfg.DataPath)
	if err != nil {
		log.Fatalf("Could not open data file: %v", err)
	}
	googleClient := calendar.NewGoogleCalendarAdapter()
	elevators := transit.NewAccessibilityRegistry()
	thirdPlacesCatalog := placesAdapter.NewThirdPlaceCatalog()
	greenSpaces := placesAdapter.NewGreenSpaceIndex()
	wearable := health.NewWearableAdapter(domain.ProviderFitbit)
	alertFormatter := notification.NewPushSender()

	// Pathfinding comes from a transit API. The mock is only a fallback so a
	// demo survives a network outage; its routes are labelled source="mock".
	mock := transit.NewMockProvider(elevators)
	var primary, fallback transit.Provider = mock, nil
	var geocoder service.Geocoder
	if cfg.TransitProvider != "mock" {
		motis := transit.NewMotisProvider(cfg.TransitAPIURL, cfg.TransitUserAgent)
		primary, fallback, geocoder = motis, mock, motis
	}

	// 2. Services
	ranker := service.NewRanker(cfg.MLAgentURL)
	calendarService := service.NewCalendarService(repo, googleClient, geocoder)
	routingService := service.NewRoutingService(primary, fallback, repo, thirdPlacesCatalog, greenSpaces, elevators, ranker)
	placeService := service.NewPlaceService(repo, thirdPlacesCatalog)
	routingService.SetForecaster(weather.NewClient(cfg.WeatherAPIURL))
	healthService := service.NewHealthService(wearable, repo)
	notificationService := service.NewNotificationService(routingService, alertFormatter)
	ecoService := service.NewEcoService()

	// 3. Initialize HTTP Transport
	server := httpTransport.NewServer(
		calendarService,
		routingService,
		placeService,
		healthService,
		notificationService,
		ecoService,
		ranker,
		repo,
	)

	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("==================================================")
	log.Printf(" Codejam 16 Multi-Modal Transit Backend starting  ")
	log.Printf(" Listening on http://localhost%s               ", addr)
	log.Printf(" Environment: %s                                  ", cfg.Environment)
	log.Printf(" Transit provider: %s (%d green spaces loaded)", primary.Name(), greenSpaces.Len())
	log.Printf(" Data: %s | %d third places | elevators from STM feed %s", cfg.DataPath, thirdPlacesCatalog.Len(), elevators.FeedVersion)
	log.Printf(" ML Agent URL: %s (optional)", cfg.MLAgentURL)
	log.Printf("==================================================")

	if err := http.ListenAndServe(addr, server); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
