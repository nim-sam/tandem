<p align="center">
  <img src="frontend/assets/favicon.png" alt="Tandem logo: a handwritten t drawn as two transit lines" width="96">
</p>

<h1 align="center">Tandem</h1>

<p align="center">
  <img alt="Go 1.26" src="https://img.shields.io/badge/Go-1.26-00ADD8?logo=go&logoColor=white">
  <img alt="React Native with Expo" src="https://img.shields.io/badge/React%20Native-Expo%2058-61DAFB?logo=react&logoColor=black">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white">
  <img alt="Python 3.10+" src="https://img.shields.io/badge/Python-3.10%2B-3776AB?logo=python&logoColor=white">
</p>

<p align="center">
  <img src="mockups/banner-readme.png" alt="Your calendar and public transit, planned together. Tandem plans the trip between every event in your day, tells you when to leave, and finds time for a greener walk. Shown beside a spread of the app's screens." width="100%">
</p>

<p align="center">A day planner for greater Montreal that joins your calendar with public transit.</p>

---

## Contents

- [What it does](#what-it-does)
- [How it works](#how-it-works)
- [Quick start](#quick-start)
- [Commands](#commands)
- [Configuration](#configuration)
- [Project layout](#project-layout)
- [Status and limits](#status-and-limits)
- [Data and attribution](#data-and-attribution)

## What it does

Routes are planned from the calendar, not from a search box: the app already knows where you have to be and when.

**Your day**

- **Routes between events.** Each day starts and ends at home (or a place you choose for that day). Every trip is planned to arrive before the event, so its departure time is your time to leave.
- **The trip that matters now.** The Day tab opens on the trip under way or next to leave, already unfolded and scrolled into view. The rest of the day is folded to one line per trip, and a dot marks where you are.
- **The day at a glance.** Time travelled, CO₂ saved against driving, and steps walked, at the top of the day.
- **Time-to-leave reminders.** Local notifications 10 minutes before and at the moment to leave (phone only).
- **Your events.** Add and edit events on the Day tab, jump to any date, import an `.ics` calendar file from Settings, and optionally sync Google Calendar.

**Hold an event for options**

Hold an event (or the home marker) and it lifts out of a blurred screen with what you can do from there:

- **Optimize for Nature.** The trip leaving it switches to its greenest way, with walks through parks marked by a pine tree. Before it applies, the app shows what changes: the steps and minutes it adds, the new lines, the parks it crosses.
- **Optimize for Steps** or **for CO₂ Saved.** That trip takes the option with the most walking, or the lowest emissions, among those that fit your schedule.
- **Finished Early.** Pick a café, a restaurant or a park nearby, narrowed down with a few words (study, coffee, terrace, pizza, vegetarian, large park…), or search for any place. Your most-picked places come first. The stop is fitted in before your next event, with the trips there and onwards planned around it.

**Getting there**

- **Map.** The open trip drawn section by section (walk, bus, metro, REM, train) with your live position; tap a stretch to zoom to it.
- **Ranked for you.** Routes are ordered by your settings (preferred and avoided modes, longest walk, step-free only) and by what you actually pick: choosing an alternative teaches a small ranking agent.
- **Free-time suggestions.** When there is slack before you need to leave, the app suggests a café, library or park that fits.

**And**

- **Saved places.** Keep the places you go to often and pick them as an event's location or a day's start or end.
- **Activity.** Steps from the phone's own pedometer, a seven-day chart, a green-walk streak, and the week's CO₂ saved with a plain comparison such as "the exhaust of 311 km driven by car".
- **Light and dark themes.**

<p align="center">
  <img src="mockups/light/01-day.png" alt="Day tab: the day's three figures, then the trip from home to the first event unfolded, with a walk through a park marked by a pine tree" width="250">
  &nbsp;&nbsp;
  <img src="mockups/light/03-options.png" alt="Holding an event: it stays sharp over a blurred screen, with Optimize for Nature, Finished Early, Optimize for Steps and Optimize for CO₂ Saved listed under it" width="250">
  &nbsp;&nbsp;
  <img src="mockups/light/06-map.png" alt="Map tab: the trip drawn in sections with line numbers, a pin at the destination and a strip of its stretches underneath" width="250">
</p>

<p align="center"><sub>The day &nbsp;·&nbsp; Hold an event for options &nbsp;·&nbsp; The trip on the map</sub></p>

## How it works

Pathfinding is done by a transit engine. The app's own logic only chooses between the routes it returns.

| Step | Who | What |
|------|-----|------|
| 1. Candidates | Transit engine ([MOTIS](https://github.com/motis-project/motis), public [Transitous](https://transitous.org) server or a local build) | Real itineraries on real timetables for "arrive at B by 11:50" |
| 2. Enrichment | Go backend | Steps, CO₂ against a car, share of the walk in green space, step-free access, slack before leaving |
| 3. Ranking | Go backend + Python agent | `score = weights · features`; weights come from your settings plus what the agent learned from your past choices |
| 4. Feedback | App → backend → agent | Picking an alternative pins it for that trip and becomes a training example |

```
 React Native app (Expo)
        │ REST/JSON
        ▼
 Go backend ──────────────► MOTIS / Transitous   (pathfinding, geocoding)
   │  enrich + rank    └──► Open-Meteo           (weather)
   │  POST /rank, /feedback
   ▼
 Python ML agent            (optional: the backend falls back to settings-only ranking)
```

More detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (design reasoning and a per-feature status table) and [docs/API_SPEC.md](docs/API_SPEC.md) (REST endpoints).

## Quick start

**You need:** Go 1.26+, Node.js 18+ with npm, Python 3.10+.

```bash
git clone git@github.com:nim-sam/tandem.git
cd tandem
make setup      # install backend, frontend and ML agent dependencies
make dev-web    # start everything and open the app in the browser
```

`make dev` does the same without opening a browser (press `w` for web or `a` for Android in the Expo prompt), and `make dev-android` opens the app in an Android emulator. Quitting Expo stops the backend and the agent.

The app starts empty. Set a home address in Settings, add a few events with addresses, and the Day tab plans the routes.

<details>
<summary><b>Laval and exo coverage: build the local routing engine</b></summary>

<br>

The public Transitous server has no timetable for the STL (Laval), so trips to, from or across Laval come back as long detours. To route on every agency of the region (STM, STL, RTL, REM, exo buses and commuter trains):

```bash
make routing    # a few minutes, about 2 GB in ./routing
```

`make dev` then uses the local engine automatically. Rebuild every few weeks: agencies publish new timetables each season, and an expired timetable returns no trips. The local engine has no live delays.

</details>

<details>
<summary><b>Running on a real phone</b></summary>

<br>

On a phone, `localhost` is the phone itself. Point the app at your computer instead:

```bash
cd frontend
cp .env.example .env
# set EXPO_PUBLIC_API_URL=http://<your computer's LAN IP>:8080/api
```

Then run `make dev` and scan the QR code with Expo Go.

</details>

<details>
<summary><b>Running the services one by one, or with Docker</b></summary>

<br>

```bash
make dev-backend    # Go API on :8080 (GET /health shows provider and agent status)
make dev-ml         # ranking agent on :8000
make dev-frontend   # Expo
```

```bash
docker compose up --build   # backend on :8080 and agent on :8000
```

</details>

## Commands

| Command | What it does |
|---|---|
| `make setup` | Install dependencies for the backend, frontend and ML agent |
| `make dev` | Run the whole stack; Expo in the foreground |
| `make dev-web` | Same, opening the app in the browser |
| `make dev-android` | Same, opening the app in an Android emulator |
| `make routing` | Build the local routing engine with every Montreal-area agency |
| `make test` | Go tests, ML agent tests and the frontend typecheck |
| `make logs` | Follow the backend and ML agent logs |
| `make stop` | Stop background servers left over from `make dev` |
| `make data` | Refresh bundled data: parks, places to stop at (cafés, restaurants, libraries), step-free stations |
| `make reset-data` | Delete saved events, places, settings and planned routes |

## Configuration

All settings are optional environment variables.

| Variable | Used by | Default | Purpose |
|---|---|---|---|
| `EXPO_PUBLIC_API_URL` | app (`frontend/.env`) | `http://localhost:8080/api` | Where the app finds the backend |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | app (`frontend/.env`) | unset | Google OAuth client ID; shows the Google Calendar sync button |
| `TRANSIT_PROVIDER` | backend | `transitous` | `mock` runs offline with hardcoded demo routes |
| `TRANSIT_API_URL` | backend | `https://api.transitous.org` | MOTIS server to route with; `make dev` sets it to the local engine when built |
| `TRANSIT_USER_AGENT` | backend | `tandem/0.1 (hackathon prototype)` | Sent to the transit API; Transitous asks for an app name and a contact |
| `ML_AGENT_URL` | backend | `http://localhost:8000` | Ranking agent |
| `DATA_PATH` | backend | `data/app.db` | SQLite database file |
| `PORT` | backend | `8080` | Backend port |

## Project layout

```
├── backend/                     # Go REST API (:8080)
│   ├── cmd/api/                 # entry point
│   ├── internal/domain/         # entities: events, routes, preferences, ranking weights
│   ├── internal/service/        # routing, calendar, places, health, ranking
│   ├── internal/adapter/        # transit engine, .ics and Google Calendar, parks, weather, SQLite
│   └── internal/transport/http/ # handlers
├── frontend/                    # React Native app (Expo): Android, iOS, web
│   └── src/
│       ├── screens/             # Day, Map, Places, Activity, Settings
│       ├── components/          # CommuteCard, TripMap, dialogs
│       ├── store/               # app state
│       └── theme/               # colours and type
├── ml-agent/                    # route-ranking agent (FastAPI, :8000)
├── scripts/                     # routing engine setup, bundled-data refresh, icon, pattern and banner generators
├── docs/                        # architecture, API, UI concept
├── mockups/                     # screenshots, light and dark
└── Makefile
```

## Status and limits

Tandem is a hackathon prototype for a single user.

- **No accounts.** One hardcoded user; everything is stored in `backend/data/app.db`.
- **Google Calendar sync** is hidden until OAuth client IDs are set, and has only been tested against a fake server.
- **Step counts** are exact on iOS; Android counts only while the app is open; a browser has no step sensor.
- **Time-to-leave notifications** are not available in a browser.
- **CO₂ figures** are estimates from per-mode averages, and the comparisons (car distance, gasoline, trees) are rough.
- **Places to stop at** come from OpenStreetMap, which has no prices: restaurants can be narrowed down by cuisine and service, not by cost. Walking times to them are straight-line estimates.
- **Blur effects** (frosted cards, the blurred screen behind options) need a browser; on a phone those surfaces are translucent or nearly opaque instead.
- **Step-free access** comes from a static station list, not live elevator outages.
- **Live delays** appear only with the public Transitous server and are cached for 15 minutes.

## Data and attribution

- Transit timetables: [Transitous sources](https://transitous.org/sources/) and the agencies' open data (STM, STL, RTL, REM, exo).
- Maps, parks and places: © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.
- Weather: [Open-Meteo](https://open-meteo.com).
