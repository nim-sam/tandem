# Architecture

## The one decision that shapes everything

**Pathfinding is done by a transit API. ML only chooses between the routes the API returns.**

A model that "finds routes" would need the full STM/REM/exo timetable graph, a
correct time-dependent shortest-path search and training data we don't have. It
would be slower and worse than an existing router, and wrong directions make
someone miss a class. So the split is:

| Step | Who | What |
|------|-----|------|
| 1. Candidates | Transit API (Transitous / MOTIS) | "Give me up to 8 ways to arrive at B by 11:50" → real itineraries on real schedules |
| 2. Enrichment | Go backend, deterministic | steps, CO2 vs. car, share of the walk in green space, elevator access, slack before leaving |
| 3. Ranking | Go prior + Python ML agent | `score = weights · features`; weights = user settings + what the agent learned from past choices |
| 4. Feedback | App → backend → ML agent | user taps an alternative → that choice is pinned and becomes a training example |

```
 React Native app (Expo)
        │ REST/JSON
        ▼
 Go backend ──────────────► Transitous API   (pathfinding, geocoding; free, no key)
   │  enrich + rank
   │  POST /rank, /feedback
   ▼
 Python ML agent            (optional: backend falls back to settings-only ranking)
```

### Why this is honest ML and not a buzzword

The agent (`ml-agent/agent/ranker.py`) is a pairwise logistic-regression
ranker (the linear case of RankNet / Bradley–Terry). Every time the user picks
route *c* over alternatives *r*, it nudges a per-user weight correction so that
*c* would have scored higher. Concretely: pick the step-free bus route over the
faster metro once and the `bus` weight rises and `inaccessible` falls for that
user, which changes the ranking of every later commute.

- **Cold start:** with no feedback the correction is zero and ranking equals
  the settings-based prior (`domain.PriorWeights`). No training data needed.
- **Failure mode:** agent down or slow → backend uses the prior (same formula,
  same features), skips the agent for 30 s, and the app is unaffected.
- **Explainable:** the `reason` on each route ("Faster, lower emissions") is
  computed from the same weights, so the UI can say why.
- **Bounded:** learned corrections are capped so a few taps cannot override a
  hard need such as "require elevator".

What it deliberately does not do: generate routes, predict delays, or explore
randomly (a commute planner that sometimes shows a worse route first to
"explore" is a bad demo).

## Transit provider

`backend/internal/adapter/transit`

- `provider.go`: `Provider` interface (`Plan(req) → []Route`).
- `motis.go`: client for the MOTIS API. Default server is
  [Transitous](https://transitous.org) which includes STM, REM, exo, RTL, STL.
  Also provides geocoding (address → coordinates) for `.ics` imports.
- `mock.go`: one hardcoded itinerary. Used only as a fallback when the API is
  unreachable (or with `TRANSIT_PROVIDER=mock`). Its routes have
  `source: "mock"` and the UI labels them as demo data.

**Transitous usage rules** (https://transitous.org/api/): project must be
open-source and non-commercial, stay around ≤ 720 `/plan` requests per day,
send a `User-Agent` with app name, version and a contact (set
`TRANSIT_USER_AGENT`), and show attribution (link to
https://transitous.org/sources/ and OpenStreetMap). The backend caches
provider responses for 15 minutes for this reason. If the public server is
unavailable during the demo, the same client works against a self-hosted MOTIS
(`TRANSIT_API_URL`).

## How each feature maps to code

| Feature | Where | Status |
|---------|-------|--------|
| Routes between events | `service/routing_service.go` | Live. Planned as *arrive by (event start − buffer)*, so the route's departure time **is** the time to leave. A day starts and ends at home (or at the place chosen for that date): one more commute to the first event, and one back from the last, leaving when it ends. Home is a place, not an event. Fetched itineraries and the option the user picked are saved in the database, so a planned day reopens without calling the provider (refreshed every 15 min for trips in the next 24 h, daily beyond that, never for past trips); if the provider is down the saved itinerary is used before the mock. |
| Time-to-leave | `frontend/src/hooks/useLeaveNotifications.ts` | The app schedules **local** notifications (10 min before, and at leave time) with `expo-notifications`. No push server. Not available in a browser. |
| Route map | `frontend/src/components/RouteMap.tsx` | Leaflet in a web view, legs drawn from the API's geometry in each line's colour. OpenStreetMap public tiles: fine for a prototype, not for a released app (see below). |
| Mode preferences | `domain/ranking.go` `PriorWeights` | Live. Preferred modes get a bonus, avoided modes a strong penalty. |
| CO2 saved | `routing_service.go` `enrich`, `domain/eco.go` | Live, per-leg distance × per-mode factor vs. a car. Factors are rough estimates. |
| Accessibility | `enrich` + `transit/accessibility.go` | Vehicle accessibility from the API. Station list generated from the official STM feed (`scripts/fetch_station_access.py`): 25 of 68 stations step-free. Static: not live elevator outages. |
| Nature score | `places/green_spaces.go` | Live. Share of each walking leg inside/next to one of ~2,100 OpenStreetMap parks. |
| Park walk ("touch grass") | `routing_service.go` `parkWalk` | Live. For trips of 2.5 km or less, with green routes on and dry weather, a walk routed through the largest park near the way is added as a candidate. |
| Weather | `adapter/weather/openmeteo.go` | Live (Open-Meteo, no key, non-commercial terms). Rain, snow or below −10 °C turns off park walks and limits suggestions to indoor places. |
| Third-place suggestions | `places/third_places.go` | 5 hand-picked places + ~1,500 cafés, libraries and community centres from OpenStreetMap. Suggested when free time before leaving covers the detour. Detour time is a straight-line estimate. |
| Live delays | `transit/motis.go` | Each leg carries `real_time` and `delay_minutes` when the feed provides them. Provider responses are cached 15 minutes, so this is not second-by-second. |
| .ics import | `adapter/calendar/ics_parser.go` | Live. Locations geocoded. Recurring events (DAILY/WEEKLY/MONTHLY/YEARLY with INTERVAL, COUNT, UNTIL, BYDAY) expanded; EXDATE is not handled. |
| Google Calendar | `adapter/calendar/google_calendar.go` | Real client for Calendar API v3 (fetch, create, update, delete) using an access token from the app's Google sign-in. **Tested only against a fake server**: needs OAuth client IDs in `frontend/.env` to use for real. Without them the app loads labelled demo events. |
| Event editing | `service/calendar_service.go` | Add, edit, delete; `GET /calendar/events?from=&to=` for week views. |
| Step counts | `frontend/src/hooks/usePhoneSteps.ts`, `service/health_service.go` | Phone pedometer is real (exact on iOS; Android counts only while the app is open). Fitbit / Garmin are **simulated** and labelled. |
| Weekly totals, streak | `service/health_service.go` `GetWeekStats` | From the day's planned routes (not measured), plus measured phone steps. |
| "Why this route" | `GET /api/ml/weights`, Settings screen | Shows what the ranking agent has learned; can be reset. |
| Saved places | `service/place_service.go` | Collections with create, rename, delete; places with add (geocoded), move, delete; usable as an event location or as home. |
| Storage | `adapter/repository/sqlite.go` | One SQLite database, `backend/data/app.db` (`DATA_PATH`), via the pure-Go `modernc.org/sqlite` driver: events, collections, preferences, day stats, per-day start/end places, planned routes and route choices. Starts empty (no seed data). Single user. |

Not built: user accounts (one hardcoded user), Fitbit/Garmin integrations.

## Map: prototype vs. release

The map uses OpenStreetMap's public tile server, which is free with attribution
but forbids heavy use and has no uptime guarantee. For a released app, change
the tile URL in `RouteMap.tsx` to a hosted provider (most have a free tier and
need a key), or switch to `react-native-maps` (Google Maps on Android, Apple
Maps on iOS; needs a Google Maps API key and a development build, and does not
run on web).
