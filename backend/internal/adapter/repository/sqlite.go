// Package repository stores everything the app saves in one SQLite database.
package repository

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"

	_ "modernc.org/sqlite" // pure Go driver, so the binary still builds with CGO_ENABLED=0

	"github.com/nim-sam/tandem/backend/internal/domain"
)

// Repository is the app's storage: events, saved places, settings, day
// statistics, where each day starts and ends, and the routes already planned.
// A new database is empty; nothing is seeded.
//
// Rows hold the domain value as JSON next to the few columns that are queried
// (an event's start time, a route's fetch time). That is plenty for a
// single-user prototype and keeps the schema stable while the domain moves.
type Repository struct {
	mu sync.Mutex // makes read-modify-write (collections, stats) atomic
	db *sql.DB
}

const schema = `
CREATE TABLE IF NOT EXISTS events (
	id         TEXT PRIMARY KEY,
	start_time INTEGER NOT NULL, -- unix seconds
	end_time   INTEGER NOT NULL,
	data       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS events_start ON events(start_time);
CREATE TABLE IF NOT EXISTS collections (
	id   TEXT PRIMARY KEY,
	data TEXT NOT NULL -- the collection with its places
);
CREATE TABLE IF NOT EXISTS preferences (
	user_id TEXT PRIMARY KEY,
	data    TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS day_stats (
	date TEXT PRIMARY KEY, -- YYYY-MM-DD
	data TEXT NOT NULL
);
-- Where a day starts ("origin") or ends ("destination") when it is not home.
CREATE TABLE IF NOT EXISTS day_endpoints (
	date  TEXT NOT NULL,
	which TEXT NOT NULL,
	data  TEXT NOT NULL,
	PRIMARY KEY (date, which)
);
-- Itineraries already fetched from the transit provider, by request.
CREATE TABLE IF NOT EXISTS routes (
	key        TEXT PRIMARY KEY,
	trip_time  INTEGER NOT NULL,
	fetched_at INTEGER NOT NULL,
	data       TEXT NOT NULL
);
-- The option the user picked for a commute ("origin>destination").
CREATE TABLE IF NOT EXISTS route_choices (
	pair_key  TEXT PRIMARY KEY,
	signature TEXT NOT NULL
);`

// NewMemoryRepository returns an empty repository that is not saved anywhere.
func NewMemoryRepository() *Repository {
	repo, err := Open("")
	if err != nil {
		panic(err)
	}
	return repo
}

// Open opens (creating it if needed) the database at path. An empty path
// means memory only.
func Open(path string) (*Repository, error) {
	dsn := ":memory:"
	if path != "" {
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			return nil, err
		}
		dsn = "file:" + path + "?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)"
	}
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	// One connection: an in-memory database exists per connection, and a
	// single user does not need concurrent writers.
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(schema); err != nil {
		db.Close()
		return nil, fmt.Errorf("could not prepare database %s: %w", path, err)
	}
	// Planned routes older than a month are never looked at again.
	_, _ = db.Exec(`DELETE FROM routes WHERE fetched_at < ?`, time.Now().AddDate(0, -1, 0).Unix())
	return &Repository{db: db}, nil
}

// Close releases the database.
func (r *Repository) Close() error { return r.db.Close() }

func (r *Repository) exec(query string, args ...any) {
	if _, err := r.db.Exec(query, args...); err != nil {
		log.Printf("database write failed: %v", err)
	}
}

func encode(v any) string {
	data, err := json.Marshal(v)
	if err != nil {
		log.Printf("could not encode %T: %v", v, err)
	}
	return string(data)
}

// get loads one JSON row into out; false when there is none.
func (r *Repository) get(out any, query string, args ...any) bool {
	var data string
	if err := r.db.QueryRow(query, args...).Scan(&data); err != nil {
		if err != sql.ErrNoRows {
			log.Printf("database read failed: %v", err)
		}
		return false
	}
	if err := json.Unmarshal([]byte(data), out); err != nil {
		log.Printf("stored row is not readable: %v", err)
		return false
	}
	return true
}

// Events

func (r *Repository) events(query string, args ...any) []domain.Event {
	rows, err := r.db.Query(query, args...)
	if err != nil {
		log.Printf("database read failed: %v", err)
		return []domain.Event{}
	}
	defer rows.Close()
	res := []domain.Event{}
	for rows.Next() {
		var data string
		var e domain.Event
		if rows.Scan(&data) == nil && json.Unmarshal([]byte(data), &e) == nil {
			res = append(res, e)
		}
	}
	return res
}

// GetEvents returns every event, earliest first.
func (r *Repository) GetEvents() []domain.Event {
	return r.events(`SELECT data FROM events ORDER BY start_time, id`)
}

// GetEventsBetween returns the events starting inside [from, to), earliest first.
func (r *Repository) GetEventsBetween(from, to time.Time) []domain.Event {
	return r.events(`SELECT data FROM events WHERE start_time >= ? AND start_time < ? ORDER BY start_time, id`, from.Unix(), to.Unix())
}

func (r *Repository) GetEvent(id string) (domain.Event, bool) {
	var e domain.Event
	ok := r.get(&e, `SELECT data FROM events WHERE id = ?`, id)
	return e, ok
}

const upsertEvent = `INSERT INTO events (id, start_time, end_time, data) VALUES (?, ?, ?, ?)
	ON CONFLICT(id) DO UPDATE SET start_time = excluded.start_time, end_time = excluded.end_time, data = excluded.data`

func (r *Repository) SaveEvent(e domain.Event) {
	r.exec(upsertEvent, e.ID, e.StartTime.Unix(), e.EndTime.Unix(), encode(e))
}

// SaveEvents stores several events in one transaction.
func (r *Repository) SaveEvents(events []domain.Event) {
	r.mu.Lock()
	defer r.mu.Unlock()
	tx, err := r.db.Begin()
	if err != nil {
		log.Printf("database write failed: %v", err)
		return
	}
	for _, e := range events {
		if _, err := tx.Exec(upsertEvent, e.ID, e.StartTime.Unix(), e.EndTime.Unix(), encode(e)); err != nil {
			log.Printf("database write failed: %v", err)
			_ = tx.Rollback()
			return
		}
	}
	if err := tx.Commit(); err != nil {
		log.Printf("database write failed: %v", err)
	}
}

func (r *Repository) DeleteEvent(id string) {
	r.exec(`DELETE FROM events WHERE id = ?`, id)
}

// Collections

func (r *Repository) GetCollections() []domain.Collection {
	res := []domain.Collection{}
	rows, err := r.db.Query(`SELECT data FROM collections`)
	if err != nil {
		log.Printf("database read failed: %v", err)
		return res
	}
	defer rows.Close()
	for rows.Next() {
		var data string
		var c domain.Collection
		if rows.Scan(&data) == nil && json.Unmarshal([]byte(data), &c) == nil {
			res = append(res, c)
		}
	}
	sort.Slice(res, func(i, j int) bool {
		return res[i].CreatedAt.Before(res[j].CreatedAt) || (res[i].CreatedAt.Equal(res[j].CreatedAt) && res[i].ID < res[j].ID)
	})
	return res
}

func (r *Repository) GetCollection(id string) (domain.Collection, bool) {
	var c domain.Collection
	ok := r.get(&c, `SELECT data FROM collections WHERE id = ?`, id)
	return c, ok
}

func (r *Repository) SaveCollection(c domain.Collection) {
	if c.Places == nil {
		c.Places = []domain.SavedPlace{}
	}
	r.exec(`INSERT INTO collections (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data`, c.ID, encode(c))
}

func (r *Repository) DeleteCollection(id string) bool {
	res, err := r.db.Exec(`DELETE FROM collections WHERE id = ?`, id)
	if err != nil {
		log.Printf("database write failed: %v", err)
		return false
	}
	n, _ := res.RowsAffected()
	return n > 0
}

func (r *Repository) AddPlaceToCollection(collectionID string, place domain.SavedPlace) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	col, ok := r.GetCollection(collectionID)
	if !ok {
		return false
	}
	place.CollectionID = collectionID
	col.Places = append(col.Places, place)
	r.SaveCollection(col)
	return true
}

// RemovePlace deletes a place from a collection and returns it.
func (r *Repository) RemovePlace(collectionID, placeID string) (domain.SavedPlace, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.removePlace(collectionID, placeID)
}

func (r *Repository) removePlace(collectionID, placeID string) (domain.SavedPlace, bool) {
	col, ok := r.GetCollection(collectionID)
	if !ok {
		return domain.SavedPlace{}, false
	}
	for i, p := range col.Places {
		if p.ID == placeID {
			col.Places = append(col.Places[:i:i], col.Places[i+1:]...)
			r.SaveCollection(col)
			return p, true
		}
	}
	return domain.SavedPlace{}, false
}

// MovePlace moves a place between collections.
func (r *Repository) MovePlace(fromID, placeID, toID string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	target, ok := r.GetCollection(toID)
	if !ok || fromID == toID {
		return false
	}
	place, ok := r.removePlace(fromID, placeID)
	if !ok {
		return false
	}
	place.CollectionID = toID
	target.Places = append(target.Places, place)
	r.SaveCollection(target)
	return true
}

// User preferences

func (r *Repository) GetUserPreferences(userID string) domain.UserPreferences {
	var pref domain.UserPreferences
	if !r.get(&pref, `SELECT data FROM preferences WHERE user_id = ?`, userID) {
		return domain.DefaultUserPreferences(userID)
	}
	if pref.Appearance == "" {
		pref.Appearance = "light"
	}
	return pref
}

func (r *Repository) SaveUserPreferences(p domain.UserPreferences) {
	r.exec(`INSERT INTO preferences (user_id, data) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data`, p.UserID, encode(p))
}

// Day statistics

func (r *Repository) GetDayStats(date string) domain.DayStats {
	var st domain.DayStats
	r.get(&st, `SELECT data FROM day_stats WHERE date = ?`, date)
	st.Date = date
	return st
}

// UpdateDayStats applies fn to the stored stats for a date and saves if they changed.
func (r *Repository) UpdateDayStats(date string, fn func(*domain.DayStats)) {
	r.mu.Lock()
	defer r.mu.Unlock()
	before := r.GetDayStats(date)
	after := before
	fn(&after)
	if after != before {
		r.exec(`INSERT INTO day_stats (date, data) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET data = excluded.data`, date, encode(after))
	}
}

// Day endpoints: where a day starts or ends when that is not home.

func (r *Repository) GetDayEndpoint(date, which string) (domain.DayEndpoint, bool) {
	var ep domain.DayEndpoint
	ok := r.get(&ep, `SELECT data FROM day_endpoints WHERE date = ? AND which = ?`, date, which)
	return ep, ok
}

func (r *Repository) SaveDayEndpoint(date, which string, ep domain.DayEndpoint) {
	r.exec(`INSERT INTO day_endpoints (date, which, data) VALUES (?, ?, ?)
		ON CONFLICT(date, which) DO UPDATE SET data = excluded.data`, date, which, encode(ep))
}

func (r *Repository) DeleteDayEndpoint(date, which string) {
	r.exec(`DELETE FROM day_endpoints WHERE date = ? AND which = ?`, date, which)
}

// Planned routes

// GetRoutes returns the itineraries saved for a provider request and when
// they were fetched. An empty list is a valid saved answer ("no route").
func (r *Repository) GetRoutes(key string) (routes []domain.Route, fetchedAt time.Time, ok bool) {
	var data string
	var fetched int64
	if err := r.db.QueryRow(`SELECT data, fetched_at FROM routes WHERE key = ?`, key).Scan(&data, &fetched); err != nil {
		return nil, time.Time{}, false
	}
	if err := json.Unmarshal([]byte(data), &routes); err != nil {
		return nil, time.Time{}, false
	}
	return routes, time.Unix(fetched, 0), true
}

// SaveRoutes stores the itineraries fetched for a request. tripTime is when
// the trip itself happens.
func (r *Repository) SaveRoutes(key string, tripTime time.Time, routes []domain.Route) {
	if routes == nil {
		routes = []domain.Route{}
	}
	r.exec(`INSERT INTO routes (key, trip_time, fetched_at, data) VALUES (?, ?, ?, ?)
		ON CONFLICT(key) DO UPDATE SET trip_time = excluded.trip_time, fetched_at = excluded.fetched_at, data = excluded.data`,
		key, tripTime.Unix(), time.Now().Unix(), encode(routes))
}

// GetRouteChoice returns the signature of the option the user picked for a commute.
func (r *Repository) GetRouteChoice(pairKey string) (string, bool) {
	var sig string
	err := r.db.QueryRow(`SELECT signature FROM route_choices WHERE pair_key = ?`, pairKey).Scan(&sig)
	return sig, err == nil
}

func (r *Repository) SaveRouteChoice(pairKey, signature string) {
	r.exec(`INSERT INTO route_choices (pair_key, signature) VALUES (?, ?)
		ON CONFLICT(pair_key) DO UPDATE SET signature = excluded.signature`, pairKey, signature)
}
