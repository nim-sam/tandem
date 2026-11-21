# EcoCommute (Codejam 16)

> Multi-modal urban transit planner with external calendar synchronization, dynamic nature-focused rescheduling ("Touch Grass" prize), accessibility elevator tracking (STM Metro & CDPQ REM), carbon savings calculation, and wearable health integration.

---

## How it works

1. A free transit API ([Transitous](https://transitous.org), STM + REM + exo + RTL/STL schedules) finds candidate routes between consecutive calendar events.
2. The Go backend adds steps, CO2 saved, green-space exposure and elevator access to each candidate.
3. Candidates are ranked by the user's settings, adjusted by a small ML agent that learns from which alternatives the user picks.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the reasoning and a per-feature status table (what is live vs. simulated).

**Laval (STL) buses:** the public routing server the app uses by default has no STL timetable, so trips involving Laval are routed on exo buses only. Run `make routing` once (a few minutes, about 2 GB) to build a local routing engine with every agency of the region; `make dev` then uses it automatically.

**Not real yet:** Fitbit/Garmin step counts (simulated and labelled; the phone pedometer is real), and Google Calendar sync until you add OAuth client IDs to `frontend/.env`. The app starts empty: no sample events or places. Everything you add, and every route already planned, is saved to a SQLite database, `backend/data/app.db`; `make reset-data` wipes it.

---

## 🏗️ Repository Architecture

This project is organized as a layered monorepo:

```
├── backend/                     # Go 1.22+ Clean Architecture REST API
│   ├── cmd/api/main.go          # Server entrypoint (:8080)
│   ├── internal/domain/         # Pure business entities (Event, Route, IntermodalNode)
│   ├── internal/service/        # Application services (Routing, Calendar, Eco, Health)
│   ├── internal/adapter/        # External integrations (transit API, ICS, parks; Google/wearables simulated)
│   └── internal/transport/http/ # REST HTTP Handlers
│
├── frontend/                    # React Native (Expo) Mobile App
│   ├── src/components/timeline/ # DayTimeline & IntermodalNode visualizer
│   ├── src/components/routing/  # CO2Badge & NatureDetourCard
│   ├── src/screens/             # DayView, Calendar, SavedPlaces, Health, Settings
│   ├── src/store/AppContext.tsx # Global application state
│   └── src/theme/               # Material 3 Design (Paper)
│
├── ml-agent/                    # Route-ranking agent (FastAPI + Python, optional at runtime)
│   ├── agent/ranker.py          # Pairwise logistic ranker: learns per-user weights from choices
│   └── server.py                # /rank, /feedback (:8000)
│
├── scripts/                     # Refresh bundled data: parks, third places, step-free stations (make data)
│
├── docs/                        # Architecture guides, API specifications, UI concepts
├── docker-compose.yml           # Monorepo containerization
└── Makefile                     # Developer commands
```

---

## 🚀 Quick Start

### 1. Prerequisites
- **Go** (1.22+)
- **Node.js** (v18+) & **npm**
- **Python** (3.10+)

### 2. Running with Docker Compose
```bash
docker compose up --build
```
- Go Backend: `http://localhost:8080`
- ML Agent: `http://localhost:8000`

### 3. Running Locally

#### Backend (Go)
```bash
cd backend
# Transitous requires a contact in the User-Agent (e-mail or URL)
export TRANSIT_USER_AGENT="your-app-name/0.1 (contact: you@example.com)"
TZ=America/Toronto go run ./cmd/api
# Runs on http://localhost:8080; GET /health shows provider + ML agent status
# TRANSIT_PROVIDER=mock runs fully offline with hardcoded demo routes
```

#### ML Agent (Python)
```bash
cd ml-agent
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python server.py
# Runs on http://localhost:8000
```

#### Frontend (React Native / Expo)
```bash
cd frontend
npm install
cp .env.example .env   # on a real phone, set EXPO_PUBLIC_API_URL to your laptop's LAN IP
npx expo start
```

### 4. Tests
```bash
make test   # Go tests, ML agent tests, frontend typecheck
```

Transit data: [Transitous sources](https://transitous.org/sources/). Map and park data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.
