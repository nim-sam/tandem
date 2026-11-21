package repository

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"

	"github.com/nim-sam/codejam16/backend/internal/domain"
)

// MemoryRepository keeps everything in memory and, when given a path, mirrors
// it to one JSON file after every change so data survives restarts. That is
// plenty for a single-user prototype; swap for a real database when there are
// several users.
type MemoryRepository struct {
	mu          sync.RWMutex
	path        string // "" = memory only
	events      map[string]domain.Event
	collections map[string]domain.Collection
	preferences map[string]domain.UserPreferences
	stats       map[string]domain.DayStats // by date YYYY-MM-DD
}

type snapshot struct {
	Events      map[string]domain.Event           `json:"events"`
	Collections map[string]domain.Collection      `json:"collections"`
	Preferences map[string]domain.UserPreferences `json:"preferences"`
	Stats       map[string]domain.DayStats        `json:"stats"`
}

// NewMemoryRepository returns a memory-only repository with demo data.
func NewMemoryRepository() *MemoryRepository {
	repo, _ := Open("")
	return repo
}

// Open loads the repository from path, or seeds demo data if the file does
// not exist yet. An empty path means memory only.
func Open(path string) (*MemoryRepository, error) {
	repo := &MemoryRepository{
		path:        path,
		events:      make(map[string]domain.Event),
		collections: make(map[string]domain.Collection),
		preferences: make(map[string]domain.UserPreferences),
		stats:       make(map[string]domain.DayStats),
	}
	if path != "" {
		data, err := os.ReadFile(path)
		if err == nil {
			var snap snapshot
			if err := json.Unmarshal(data, &snap); err != nil {
				return nil, fmt.Errorf("data file %s is corrupt: %w", path, err)
			}
			if snap.Events != nil {
				repo.events = snap.Events
			}
			if snap.Collections != nil {
				repo.collections = snap.Collections
			}
			if snap.Preferences != nil {
				repo.preferences = snap.Preferences
			}
			if snap.Stats != nil {
				repo.stats = snap.Stats
			}
			return repo, nil
		}
		if !os.IsNotExist(err) {
			return nil, err
		}
	}
	repo.seedInitialData()
	repo.save()
	return repo, nil
}

// save writes the snapshot atomically. Callers must hold the write lock (or be
// the only reference, as in Open).
func (r *MemoryRepository) save() {
	if r.path == "" {
		return
	}
	data, err := json.MarshalIndent(snapshot{r.events, r.collections, r.preferences, r.stats}, "", " ")
	if err != nil {
		log.Printf("could not encode data file: %v", err)
		return
	}
	_ = os.MkdirAll(filepath.Dir(r.path), 0o755)
	tmp := r.path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err == nil {
		err = os.Rename(tmp, r.path)
		if err != nil {
			log.Printf("could not write data file: %v", err)
		}
	} else {
		log.Printf("could not write data file: %v", err)
	}
}

func (r *MemoryRepository) seedInitialData() {
	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

	// Default preferences
	r.preferences["default_user"] = domain.DefaultUserPreferences("default_user")

	// Sample calendar events for ONE full day
	events := []domain.Event{
		{
			ID:          "evt-1",
			Title:       "Morning Lecture: Distributed Systems",
			Description: "CS 512 at McConnell Engineering Hall",
			Location:    domain.Location{Name: "McConnell Hall, McGill", Address: "3480 Rue University, Montreal", Latitude: 45.5048, Longitude: -73.5760},
			StartTime:   today.Add(9 * time.Hour),
			EndTime:     today.Add(10*time.Hour + 30*time.Minute),
			CreatedAt:   now,
			UpdatedAt:   now,
		},
		{
			ID:          "evt-2",
			Title:       "AI Research Lab & Brainstorm",
			Description: "Collaborative design session at Mila institute",
			Location:    domain.Location{Name: "Mila AI Institute", Address: "6666 Rue Saint-Urbain, Montreal", Latitude: 45.5312, Longitude: -73.6138},
			StartTime:   today.Add(12 * time.Hour),
			EndTime:     today.Add(14 * time.Hour),
			CreatedAt:   now,
			UpdatedAt:   now,
		},
		{
			ID:          "evt-3",
			Title:       "Venture Pitch Demo & Networking",
			Description: "Hardware & Software Hackathon Showcase at Brossard REM Solar Uniquartier",
			Location:    domain.Location{Name: "Solar Uniquartier REM", Address: "Brossard, QC", Latitude: 45.4485, Longitude: -73.4357},
			StartTime:   today.Add(16 * time.Hour),
			EndTime:     today.Add(18 * time.Hour),
			IsExternal:  false,
			CreatedAt:   now,
			UpdatedAt:   now,
		},
	}
	for _, e := range events {
		r.events[e.ID] = e
	}

	// Organizable Collections
	col1 := domain.Collection{
		ID:          "col-touch-grass",
		Name:        "Touch Grass & Green Sanctuaries",
		Description: "Parks, scenic trails, and waterfronts for mindful detours",
		Icon:        "pine-tree",
		Color:       "#2E7D32",
		CreatedAt:   now,
		Places: []domain.SavedPlace{
			{
				ID:           "sp-1",
				CollectionID: "col-touch-grass",
				Name:         "Mount Royal Belvedere Lookout",
				Address:      "1196 Camillien-Houde, Montreal",
				Category:     "park",
				Location:     domain.Location{Name: "Mount Royal Belvedere", Latitude: 45.5050, Longitude: -73.5875},
				Notes:        "Best spot for clear mind before afternoon exams.",
				CreatedAt:    now,
			},
			{
				ID:           "sp-2",
				CollectionID: "col-touch-grass",
				Name:         "Lachine Canal Waterfront Trail",
				Address:      "Montreal, QC",
				Category:     "park",
				Location:     domain.Location{Name: "Lachine Canal", Latitude: 45.4850, Longitude: -73.5750},
				Notes:        "Flat bike and walking path along historic locks.",
				CreatedAt:    now,
			},
		},
	}

	col2 := domain.Collection{
		ID:          "col-third-places",
		Name:        "Third Places & Deep Work Spots",
		Description: "Cafes and public spaces between home and office",
		Icon:        "coffee",
		Color:       "#6D4C41",
		CreatedAt:   now,
		Places: []domain.SavedPlace{
			{
				ID:           "sp-3",
				CollectionID: "col-third-places",
				Name:         "Crew Collective & Cafe",
				Address:      "360 Rue Saint-Jacques, Montreal",
				Category:     "third_place",
				Location:     domain.Location{Name: "Crew Collective", Latitude: 45.5020, Longitude: -73.5590},
				Notes:        "High ceilings, quiet booths, fast wifi, near Square-Victoria-OACI.",
				CreatedAt:    now,
			},
			{
				ID:           "sp-4",
				CollectionID: "col-third-places",
				Name:         "Grande Bibliothèque Garden Atrium",
				Address:      "475 De Maisonneuve Blvd E, Montreal",
				Category:     "third_place",
				Location:     domain.Location{Name: "BAnQ", Latitude: 45.5152, Longitude: -73.5623},
				Notes:        "Direct elevator access from Berri-UQAM Metro.",
				CreatedAt:    now,
			},
		},
	}

	r.collections[col1.ID] = col1
	r.collections[col2.ID] = col2
}

// Events
func (r *MemoryRepository) GetEvents() []domain.Event {
	r.mu.RLock()
	defer r.mu.RUnlock()
	res := make([]domain.Event, 0, len(r.events))
	for _, e := range r.events {
		res = append(res, e)
	}
	return res
}

func (r *MemoryRepository) GetEvent(id string) (domain.Event, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	e, ok := r.events[id]
	return e, ok
}

func (r *MemoryRepository) SaveEvent(e domain.Event) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.events[e.ID] = e
	r.save()
}

// SaveEvents stores several events with a single write to disk.
func (r *MemoryRepository) SaveEvents(events []domain.Event) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, e := range events {
		r.events[e.ID] = e
	}
	r.save()
}

func (r *MemoryRepository) DeleteEvent(id string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.events, id)
	r.save()
}

// Collections
func (r *MemoryRepository) GetCollections() []domain.Collection {
	r.mu.RLock()
	defer r.mu.RUnlock()
	res := make([]domain.Collection, 0, len(r.collections))
	for _, c := range r.collections {
		res = append(res, c)
	}
	sort.Slice(res, func(i, j int) bool {
		return res[i].CreatedAt.Before(res[j].CreatedAt) || (res[i].CreatedAt.Equal(res[j].CreatedAt) && res[i].ID < res[j].ID)
	})
	return res
}

func (r *MemoryRepository) GetCollection(id string) (domain.Collection, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	c, ok := r.collections[id]
	return c, ok
}

func (r *MemoryRepository) SaveCollection(c domain.Collection) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if c.Places == nil {
		c.Places = []domain.SavedPlace{}
	}
	r.collections[c.ID] = c
	r.save()
}

func (r *MemoryRepository) DeleteCollection(id string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.collections[id]; !ok {
		return false
	}
	delete(r.collections, id)
	r.save()
	return true
}

func (r *MemoryRepository) AddPlaceToCollection(collectionID string, place domain.SavedPlace) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	col, exists := r.collections[collectionID]
	if !exists {
		return false
	}
	place.CollectionID = collectionID
	col.Places = append(col.Places, place)
	r.collections[collectionID] = col
	r.save()
	return true
}

// RemovePlace deletes a place from a collection and returns it.
func (r *MemoryRepository) RemovePlace(collectionID, placeID string) (domain.SavedPlace, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	place, ok := r.removePlaceLocked(collectionID, placeID)
	if ok {
		r.save()
	}
	return place, ok
}

func (r *MemoryRepository) removePlaceLocked(collectionID, placeID string) (domain.SavedPlace, bool) {
	col, exists := r.collections[collectionID]
	if !exists {
		return domain.SavedPlace{}, false
	}
	for i, p := range col.Places {
		if p.ID == placeID {
			col.Places = append(append([]domain.SavedPlace{}, col.Places[:i]...), col.Places[i+1:]...)
			r.collections[collectionID] = col
			return p, true
		}
	}
	return domain.SavedPlace{}, false
}

// MovePlace moves a place between collections.
func (r *MemoryRepository) MovePlace(fromID, placeID, toID string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	target, ok := r.collections[toID]
	if !ok || fromID == toID {
		return false
	}
	place, ok := r.removePlaceLocked(fromID, placeID)
	if !ok {
		return false
	}
	place.CollectionID = toID
	target.Places = append(target.Places, place)
	r.collections[toID] = target
	r.save()
	return true
}

// User Preferences
func (r *MemoryRepository) GetUserPreferences(userID string) domain.UserPreferences {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if pref, ok := r.preferences[userID]; ok {
		if pref.HealthProvider == "" {
			pref.HealthProvider = domain.ProviderPhone
		}
		if pref.Appearance == "" {
			pref.Appearance = "dark"
		}
		return pref
	}
	return domain.DefaultUserPreferences(userID)
}

func (r *MemoryRepository) SaveUserPreferences(p domain.UserPreferences) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.preferences[p.UserID] = p
	r.save()
}

// Day statistics
func (r *MemoryRepository) GetDayStats(date string) domain.DayStats {
	r.mu.RLock()
	defer r.mu.RUnlock()
	st := r.stats[date]
	st.Date = date
	return st
}

// UpdateDayStats applies fn to the stored stats for a date and saves if they changed.
func (r *MemoryRepository) UpdateDayStats(date string, fn func(*domain.DayStats)) {
	r.mu.Lock()
	defer r.mu.Unlock()
	before := r.stats[date]
	after := before
	after.Date = date
	fn(&after)
	if after != before {
		r.stats[date] = after
		r.save()
	}
}
