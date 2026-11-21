# Tandem - REST API Specification

Base URL: `http://localhost:8080/api`

---

## 1. Calendar Endpoints

### `GET /calendar/events`
Returns all scheduled calendar events sorted chronologically.
```json
{
  "events": [
    {
      "id": "evt-1",
      "title": "Morning Lecture: McGill Engineering",
      "location": {
        "name": "McConnell Hall, McGill",
        "address": "3480 Rue University, Montreal",
        "latitude": 45.5048,
        "longitude": -73.5760
      },
      "start_time": "2026-11-20T09:00:00Z",
      "end_time": "2026-11-20T10:30:00Z",
      "is_external": true,
      "external_source": "google"
    }
  ]
}
```

### `POST /calendar/events`
Adds a new calendar event.
```json
// Request
{
  "title": "Hackathon Presentation",
  "location": {
    "name": "Solar Uniquartier REM",
    "latitude": 45.4485,
    "longitude": -73.4357
  },
  "start_time": "2026-11-20T15:00:00Z",
  "end_time": "2026-11-20T16:30:00Z"
}
```

### `DELETE /calendar/events/{id}`
Deletes an event from the calendar and synchronizes removal with Google Calendar.

### `POST /calendar/import-ics`
Imports events from an uploaded or pasted `.ics` file.
```json
// Request
{
  "source": "ics",
  "ics_content": "BEGIN:VCALENDAR\nBEGIN:VEVENT\nSUMMARY:Sprint Review\n..."
}
```

### `POST /calendar/sync-google`
Triggers synchronization with Google Calendar.

---

## 2. Routing & Commutes

### `GET /routes/day?date=YYYY-MM-DD`
Events for one local date (default today, any past or future date works) and
the commutes of that day: from where the day starts to the first located event,
between each pair of consecutive located events, and from the last one to where
the day ends.

The day starts and ends at home (`home_location` in the preferences) unless
another place was set for that date. `origin` and `destination` describe those
two places (`null` when there is no home and nothing was set). They are not
events: the commute from the start has `origin_event_id: "day-start"` and its
`departure_time` is when to leave; the commute to the end has
`destination_event_id: "day-end"`, leaves when the last event ends, and its
`arrival_time` is when the user gets there.

Each commute is the top-ranked route; the other candidates are in `alternatives`.
```json
{
  "date": "2026-11-20",
  "events": [],
  "commutes": [
    {
      "id": "r-1795191300-1795193160-5",
      "origin_event_id": "evt-1",
      "destination_event_id": "evt-2",
      "source": "transitous",
      "departure_time": "2026-11-20T16:15:00Z",
      "arrival_time": "2026-11-20T16:46:00Z",
      "total_duration_minutes": 31,
      "transfer_count": 1,
      "walk_minutes": 21,
      "total_steps": 1900,
      "co2_saved_grams": 1286.67,
      "nature_score": 0.33,
      "is_accessible": false,
      "slack_minutes": 45,
      "is_tight": false,
      "score": -0.42,
      "reason": "Faster, lower emissions",
      "ranked_by": "ml-agent",
      "features": { "duration": 0.517, "transfers": 0.333, "walk": 0.7 },
      "nodes": [
        {
          "id": "leg-1",
          "node_type": "transfer",
          "mode": "rem",
          "transit_line": "REM A4-A1",
          "station_or_stop_name": "Station McGill",
          "to_stop_name": "Station Édouard-Montpetit",
          "headsign": "A4 - Deux-Montagnes",
          "route_color": "73a400",
          "stop_count": 1,
          "instruction": "Board REM A4-A1 at Station McGill toward A4 - Deux-Montagnes, ride 1 stop(s) to Station Édouard-Montpetit",
          "departure_time": "2026-11-20T16:25:00Z",
          "arrival_time": "2026-11-20T16:28:00Z",
          "duration_minutes": 3,
          "distance_meters": 2100,
          "elevator_available": true,
          "polyline": "…",
          "polyline_precision": 6
        }
      ],
      "alternatives": [],
      "suggested_third_places": []
    }
  ],
  "summary": { "total_events": 3, "total_commute_minutes": 83, "total_steps": 3736, "total_co2_saved_grams": 5083.68, "nature_detour_eligible": true },
  "origin": { "location": { "name": "Home", "address": "…", "latitude": 45.52, "longitude": -73.58 }, "category": "home", "is_home": true },
  "destination": { "location": { "name": "Office", "latitude": 45.5, "longitude": -73.56 }, "category": "work", "is_home": false }
}
```
- `departure_time` is the time to leave (routes are planned to arrive `departure_buffer_minutes` before the event).
- `source: "mock"` means hardcoded offline demo data; label it in the UI.
- `ranked_by`: `"ml-agent"` or `"preferences"` (agent offline).

### `PUT /routes/day/{date}/{origin|destination}`
`{ "location": Location, "category": "work" }`. Starts (`origin`) or ends
(`destination`) that one day somewhere other than home. A location with
coordinates `0,0` is geocoded from its address; `404` if it cannot be found.
`category` is optional (the saved place's category; the app picks the icon from it).

### `DELETE /routes/day/{date}/{origin|destination}`
Back to home for that day.

### `GET /geocode/suggest?q=partly typed address`
Up to 6 places in the Montreal region matching what has been typed so far
(fuzzy, at least 3 characters), best first: `{ "suggestions": [Location] }`.
`name` is the place or street address ("2765 Rue du Roitelet"), `address` adds
the city, and the coordinates are filled in, so a picked suggestion needs no
further lookup.

### `PUT /routes/green`
`{ "origin_event_id": "…", "destination_event_id": "…", "green": true }`. Switches green routes on or
off for that one commute, whatever the user's setting says. Each `Route` reports the result as
`green_routes`.

### `POST /routes/select`
`{ "route_id": "…" }`. The user prefers this alternative: it becomes the route
for that commute and is sent to the ML agent as a training example. `404` if the
id is unknown (ids change when the schedule is re-planned).

### `GET /geocode?q=address`
→ `Location` with coordinates. Events posted with `latitude: 0, longitude: 0`
are geocoded automatically from `location.address` / `location.name`.

### `GET /health` (no `/api` prefix)
`{ "status": "ok", "transit_provider": "transitous", "ml_agent_online": true }`

---

## 3. Places & Collections

| Method and path | Purpose |
|---|---|
| `GET /collections` | All collections with their places |
| `POST /collections` | Create (`name`, `description`) |
| `PUT /collections/{id}` | Rename / edit |
| `DELETE /collections/{id}` | Delete with its places |
| `POST /collections/{id}/places` | Add a place (`name`, `address`, `notes`); the address is geocoded |
| `DELETE /collections/{id}/places/{placeId}` | Remove a place |
| `POST /collections/{id}/places/{placeId}/move` | `{ "to_collection_id": "…" }` |

## 4. Calendar additions

| Method and path | Purpose |
|---|---|
| `GET /calendar/events?from=YYYY-MM-DD&to=YYYY-MM-DD` | Events starting in the range (inclusive) |
| `PUT /calendar/events/{id}` | Edit title, times, location. Send `latitude: 0, longitude: 0` when the location text changed |
| `DELETE /calendar/events/{id}` | `404` if unknown |
| `POST /calendar/sync-google` | Body `{ "access_token": "…" }` from Google sign-in. `401` without a token |

## 5. Health and stats

| Method and path | Purpose |
|---|---|
| `GET /health/summary?date=` | Steps for the day, as reported by the phone |
| `POST /health/steps` | `{ "date": "YYYY-MM-DD", "steps": 5321 }` from the phone pedometer (running total for the day) |
| `GET /stats/week` | Last 7 days: planned steps, measured steps, CO2 saved, green-walk streak |

## 6. Preferences and ranking

| Method and path | Purpose |
|---|---|
| `GET` / `PUT /user/preferences` | Includes `home_location` |
| `GET /ml/weights` | Settings-based weights, the learned correction, and how many choices it learned from |
| `DELETE /ml/weights` | Forget what was learned |
