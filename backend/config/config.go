package config

import (
	"os"
)

type Config struct {
	Port        string
	Environment string
	MLAgentURL  string
	// TransitProvider is "transitous" (live schedules, default) or "mock"
	// (hardcoded offline demo data).
	TransitProvider string
	TransitAPIURL   string
	// TransitUserAgent is sent to the transit API. Transitous requires app
	// name, version and a contact (e-mail or URL): set TRANSIT_USER_AGENT.
	TransitUserAgent string
	// DataPath is the SQLite database everything is saved to.
	DataPath           string
	WeatherAPIURL      string
	GoogleClientID     string
	GoogleClientSecret string
}

func Load() *Config {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	env := os.Getenv("ENV")
	if env == "" {
		env = "development"
	}

	mlAgentURL := os.Getenv("ML_AGENT_URL")
	if mlAgentURL == "" {
		mlAgentURL = "http://localhost:8000"
	}

	return &Config{
		DataPath:           getenv("DATA_PATH", "data/app.db"),
		WeatherAPIURL:      getenv("WEATHER_API_URL", "https://api.open-meteo.com"),
		TransitProvider:    getenv("TRANSIT_PROVIDER", "transitous"),
		TransitAPIURL:      getenv("TRANSIT_API_URL", "https://api.transitous.org"),
		TransitUserAgent:   getenv("TRANSIT_USER_AGENT", "transit-day-planner/0.1 (hackathon prototype)"),
		Port:               port,
		Environment:        env,
		MLAgentURL:         mlAgentURL,
		GoogleClientID:     os.Getenv("GOOGLE_CLIENT_ID"),
		GoogleClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
