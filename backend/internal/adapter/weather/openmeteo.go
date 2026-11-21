// Package weather fetches hourly forecasts from Open-Meteo (free, no API key,
// non-commercial use; https://open-meteo.com).
package weather

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/nim-sam/tandem/backend/internal/domain"
)

type Client struct {
	baseURL string
	http    *http.Client

	mu    sync.Mutex
	cache map[string]cached
}

type cached struct {
	at    time.Time
	hours map[string]domain.Weather // "2006-01-02T15" in UTC
}

func NewClient(baseURL string) *Client {
	return &Client{baseURL: baseURL, http: &http.Client{Timeout: 6 * time.Second}, cache: map[string]cached{}}
}

// At returns the forecast for the hour containing t. It fails for times
// outside the 7-day forecast window (callers should treat that as "unknown").
func (c *Client) At(ctx context.Context, lat, lon float64, t time.Time) (domain.Weather, error) {
	key := fmt.Sprintf("%.1f,%.1f", lat, lon) // ~10 km grid: one request covers the city
	c.mu.Lock()
	entry, ok := c.cache[key]
	c.mu.Unlock()

	if !ok || time.Since(entry.at) > time.Hour {
		hours, err := c.fetch(ctx, lat, lon)
		if err != nil {
			return domain.Weather{}, err
		}
		entry = cached{at: time.Now(), hours: hours}
		c.mu.Lock()
		c.cache[key] = entry
		c.mu.Unlock()
	}
	w, ok := entry.hours[t.UTC().Format("2006-01-02T15")]
	if !ok {
		return domain.Weather{}, fmt.Errorf("no forecast for %s", t.Format(time.RFC3339))
	}
	return w, nil
}

func (c *Client) fetch(ctx context.Context, lat, lon float64) (map[string]domain.Weather, error) {
	url := fmt.Sprintf("%s/v1/forecast?latitude=%.2f&longitude=%.2f&hourly=temperature_2m,precipitation_probability,precipitation&timezone=UTC&past_days=1&forecast_days=7",
		c.baseURL, lat, lon)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("weather API: HTTP %d", resp.StatusCode)
	}
	var body struct {
		Hourly struct {
			Time          []string   `json:"time"`
			Temperature   []*float64 `json:"temperature_2m"`
			Probability   []*float64 `json:"precipitation_probability"`
			Precipitation []*float64 `json:"precipitation"`
		} `json:"hourly"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return nil, err
	}
	val := func(xs []*float64, i int) float64 {
		if i < len(xs) && xs[i] != nil {
			return *xs[i]
		}
		return 0
	}
	hours := map[string]domain.Weather{}
	for i, ts := range body.Hourly.Time {
		if len(ts) < 13 {
			continue
		}
		hours[ts[:13]] = Describe(val(body.Hourly.Temperature, i), int(val(body.Hourly.Probability, i)), val(body.Hourly.Precipitation, i))
	}
	return hours, nil
}

// Describe turns raw numbers into a Weather with a summary and an
// outdoors verdict: no park detours when rain/snow is likely or it is below -10°C.
func Describe(tempC float64, probability int, mm float64) domain.Weather {
	w := domain.Weather{TemperatureC: tempC, PrecipitationProbability: probability, PrecipitationMM: mm}
	wet := probability >= 50 || mm >= 0.5
	kind := "Rain"
	if tempC <= 0 {
		kind = "Snow"
	}
	switch {
	case wet:
		w.Summary = fmt.Sprintf("%s likely, %.0f°C", kind, tempC)
	case tempC < -10:
		w.Summary = fmt.Sprintf("Very cold, %.0f°C", tempC)
	default:
		w.Summary = fmt.Sprintf("Dry, %.0f°C", tempC)
	}
	w.GoodForOutdoors = !wet && tempC >= -10
	return w
}
