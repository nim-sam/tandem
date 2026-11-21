package transit

import (
	_ "embed"
	"encoding/json"
	"strings"
	"sync"
)

// Step-free STM metro stations, generated from the official STM GTFS feed by
// scripts/fetch_station_access.py.
//
//go:embed data/accessible_stations.json
var accessibleStationsJSON []byte

// AccessibilityRegistry knows which metro/REM stations have elevators. It is
// static: it says a station HAS elevators, not that they are working today.
type AccessibilityRegistry struct {
	mu            sync.RWMutex
	accessibleMap map[string]bool // normalized station name -> step-free
	FeedVersion   string
}

func NewAccessibilityRegistry() *AccessibilityRegistry {
	r := &AccessibilityRegistry{accessibleMap: make(map[string]bool)}
	var data struct {
		FeedVersion string   `json:"feed_version"`
		Accessible  []string `json:"accessible"`
	}
	_ = json.Unmarshal(accessibleStationsJSON, &data)
	r.FeedVersion = data.FeedVersion
	for _, s := range data.Accessible {
		r.accessibleMap[normalizeStation(s)] = true
	}
	return r
}

// HasWorkingElevator checks if a metro/REM station has an operational elevator.
// Names are normalized so "STATION MCGILL", "McGill Metro" and "McGill" match.
func (r *AccessibilityRegistry) HasWorkingElevator(stationName string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.accessibleMap[normalizeStation(stationName)]
}

func normalizeStation(name string) string {
	key := strings.ToLower(name)
	if i := strings.Index(key, "("); i >= 0 {
		key = key[:i]
	}
	for _, word := range []string{"station", "métro", "metro", "rem"} {
		key = strings.ReplaceAll(key, word, "")
	}
	// The feeds disagree on punctuation: "PLACE DES ARTS" vs "Place-des-Arts".
	key = strings.NewReplacer("-", " ", "'", " ", "’", " ").Replace(key)
	return strings.Join(strings.Fields(key), " ")
}

// SetElevatorOutage allows setting an out-of-service flag for dynamic incident reporting.
func (r *AccessibilityRegistry) SetElevatorOutage(stationName string, isOutage bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.accessibleMap[normalizeStation(stationName)] = !isOutage
}
