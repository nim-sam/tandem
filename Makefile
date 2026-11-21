SHELL := /bin/bash
.PHONY: help setup dev dev-web stop logs dev-backend dev-frontend dev-ml docker-up test data reset-data

LOGS := $(CURDIR)/.logs
# What `make dev` runs in the foreground once the servers are up.
FRONTEND_CMD ?= npx expo start

help:
	@echo "Available commands:"
	@echo "  make dev          - Run the whole stack: ML agent + backend in the background, Expo in this terminal"
	@echo "  make dev-web      - Same, opening the app in the browser"
	@echo "  make stop         - Stop background servers left over from make dev"
	@echo "  make logs         - Follow backend and ML agent logs"
	@echo "  make setup        - Install dependencies for backend, frontend, and ML agent"
	@echo "  make dev-backend  - Run Go backend locally"
	@echo "  make dev-frontend - Run React Native frontend (Expo)"
	@echo "  make dev-ml       - Run Python ML decision agent locally"
	@echo "  make docker-up    - Run all services via Docker Compose"
	@echo "  make test         - Run backend, ML agent and frontend checks"
	@echo "  make data         - Refresh bundled data: parks, third places (OpenStreetMap), step-free stations (STM)"
	@echo "  make reset-data   - Delete saved events/places/settings; the next start reseeds demo data for today"

setup:
	@echo "Setting up backend..."
	cd backend && go mod download
	@echo "Setting up frontend..."
	cd frontend && npm install
	@echo "Setting up ML agent..."
	cd ml-agent && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt

# Whole stack. ML agent and backend run in the background (logs in .logs/),
# Expo runs in the foreground so its keys (w = web, a = Android, r = reload) work.
# Ctrl+C / quitting Expo stops everything.
# Optional env: TRANSIT_USER_AGENT="app/0.1 (contact: you@example.com)", TRANSIT_PROVIDER=mock
dev: ml-agent/.venv frontend/node_modules
	@mkdir -p $(LOGS)
	@$(MAKE) --no-print-directory stop >/dev/null
	@echo "Building backend..."
	@cd backend && go build -o bin/api ./cmd/api
	@cleanup() { \
		echo; echo "Stopping backend and ML agent..."; \
		kill $$ML_PID $$API_PID 2>/dev/null; wait $$ML_PID $$API_PID 2>/dev/null; \
		rm -f $(LOGS)/*.pid; \
	}; \
	trap cleanup EXIT; trap 'exit 130' INT TERM; \
	(cd ml-agent && exec .venv/bin/python server.py) > $(LOGS)/ml-agent.log 2>&1 & ML_PID=$$!; \
	(cd backend && TZ=America/Toronto exec ./bin/api) > $(LOGS)/backend.log 2>&1 & API_PID=$$!; \
	echo $$ML_PID > $(LOGS)/ml-agent.pid; echo $$API_PID > $(LOGS)/backend.pid; \
	for i in $$(seq 1 40); do \
		curl -sf localhost:8080/health >/dev/null && curl -sf localhost:8000/health >/dev/null && break; \
		kill -0 $$API_PID 2>/dev/null || { echo "Backend failed to start:"; tail -20 $(LOGS)/backend.log; exit 1; }; \
		sleep 0.5; \
	done; \
	curl -sf localhost:8080/health >/dev/null || { echo "Backend did not come up:"; tail -20 $(LOGS)/backend.log; exit 1; }; \
	echo "Backend   http://localhost:8080  $$(curl -s localhost:8080/health)"; \
	curl -sf localhost:8000/health >/dev/null \
		&& echo "ML agent  http://localhost:8000" \
		|| echo "ML agent  NOT running (see $(LOGS)/ml-agent.log); routes are ranked by settings only"; \
	echo "Logs      make logs   (in another terminal)"; echo; \
	cd frontend && $(FRONTEND_CMD)

dev-web:
	@$(MAKE) --no-print-directory dev FRONTEND_CMD="npx expo start --web"

stop:
	@for f in $(LOGS)/*.pid; do \
		[ -f "$$f" ] && kill "$$(cat $$f)" 2>/dev/null && echo "stopped $$(basename $$f .pid)"; rm -f "$$f"; \
	done; true

logs:
	@tail -F $(LOGS)/backend.log $(LOGS)/ml-agent.log

ml-agent/.venv:
	cd ml-agent && python3 -m venv .venv && .venv/bin/pip install -q -r requirements.txt

frontend/node_modules:
	cd frontend && npm install

dev-backend:
	cd backend && TZ=America/Toronto go run ./cmd/api

dev-frontend:
	cd frontend && npx expo start

dev-ml:
	cd ml-agent && .venv/bin/python server.py

docker-up:
	docker compose up --build

test:
	cd backend && go test ./...
	cd ml-agent && python3 -m unittest discover -s tests
	cd frontend && npm run typecheck

# Refresh the datasets compiled into the backend. Rebuild the backend afterwards.
data:
	python3 scripts/fetch_green_spaces.py
	python3 scripts/fetch_third_places.py
	python3 scripts/fetch_station_access.py

# Everything the app saves lives in backend/data/store.json. The demo events are
# created for the day of the first start, so reset to get a fresh demo day.
reset-data:
	rm -f backend/data/store.json
	@echo "Saved data removed. Restart the backend to reseed demo data."
