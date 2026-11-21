SHELL := /bin/bash
.PHONY: help setup routing dev dev-web dev-android stop logs dev-backend dev-frontend dev-ml docker-up test data reset-data

LOGS := $(CURDIR)/.logs
MOTIS_PORT ?= 8082
# What `make dev` runs in the foreground once the servers are up.
FRONTEND_CMD ?= npx expo start

help:
	@echo "Available commands:"
	@echo "  make dev          - Run the whole stack: ML agent + backend in the background, Expo in this terminal"
	@echo "  make dev-web      - Same, opening the app in the browser"
	@echo "  make dev-android  - Same, opening the app in an Android emulator (needs Android Studio's SDK and a virtual device)"
	@echo "  make stop         - Stop background servers left over from make dev"
	@echo "  make logs         - Follow backend and ML agent logs"
	@echo "  make routing      - Build the local routing engine with every Montreal-area agency, STL (Laval) included; rerun every few weeks"
	@echo "  make setup        - Install dependencies for backend, frontend, and ML agent"
	@echo "  make dev-backend  - Run Go backend locally"
	@echo "  make dev-frontend - Run React Native frontend (Expo)"
	@echo "  make dev-ml       - Run Python ML decision agent locally"
	@echo "  make docker-up    - Run all services via Docker Compose"
	@echo "  make test         - Run backend, ML agent and frontend checks"
	@echo "  make data         - Refresh bundled data: parks, third places (OpenStreetMap), step-free stations (STM)"
	@echo "  make reset-data   - Delete saved events, places, settings and planned routes; the app starts empty"

# Local routing engine. The public Transitous server has no STL (Laval)
# timetable; this builds our own MOTIS with every agency of the region.
routing:
	./scripts/setup_routing.sh

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
		kill $$ML_PID $$API_PID $$MOTIS_PID 2>/dev/null; wait $$ML_PID $$API_PID $$MOTIS_PID 2>/dev/null; \
		rm -f $(LOGS)/*.pid; \
	}; \
	trap cleanup EXIT; trap 'exit 130' INT TERM; \
	(cd ml-agent && exec .venv/bin/python server.py) > $(LOGS)/ml-agent.log 2>&1 & ML_PID=$$!; \
	MOTIS_PID=""; \
	if [ -f routing/.built ]; then \
		(cd routing && exec ./motis server) > $(LOGS)/motis.log 2>&1 & MOTIS_PID=$$!; echo $$MOTIS_PID > $(LOGS)/motis.pid; \
		echo "Starting the local routing engine (timetables from $$(cat routing/.built))..."; \
		for i in $$(seq 1 120); do \
			curl -sf -o /dev/null "localhost:$(MOTIS_PORT)/api/v1/geocode?text=montreal" && break; \
			kill -0 $$MOTIS_PID 2>/dev/null || break; sleep 0.5; \
		done; \
		if curl -sf -o /dev/null "localhost:$(MOTIS_PORT)/api/v1/geocode?text=montreal"; then \
			export TRANSIT_API_URL=http://localhost:$(MOTIS_PORT); \
		else \
			echo "Local routing engine did not start (see $(LOGS)/motis.log); using Transitous"; kill $$MOTIS_PID 2>/dev/null; MOTIS_PID=""; \
		fi; \
	fi; \
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
	[ -n "$$MOTIS_PID" ] \
		&& echo "Routing   local MOTIS on :$(MOTIS_PORT), all Montreal-area agencies incl. STL (no live delays)" \
		|| echo "Routing   Transitous (public server: has NO STL/Laval buses; run 'make routing' once to add them)"; \
	echo "Logs      make logs   (in another terminal)"; echo; \
	cd frontend && $(FRONTEND_CMD)

dev-web:
	@$(MAKE) --no-print-directory dev FRONTEND_CMD="npx expo start --web"

# Android emulator. Inside it "localhost" is the virtual phone itself; 10.0.2.2
# is the emulator's name for this computer, so the app is pointed there.
# Expo starts a virtual device if none is running and installs Expo Go in it.
ANDROID_SDK ?= $(or $(ANDROID_HOME),$(ANDROID_SDK_ROOT),$(HOME)/Android/Sdk)
dev-android:
	@if [ ! -x "$(ANDROID_SDK)/platform-tools/adb" ]; then \
		echo "No Android SDK found at $(ANDROID_SDK)."; \
		echo "Install Android Studio, create a virtual device (More Actions > Virtual Device Manager),"; \
		echo "then run this again. If the SDK is elsewhere: make dev-android ANDROID_SDK=/path/to/Sdk"; \
		exit 1; \
	fi
	@if [ -z "$$($(ANDROID_SDK)/emulator/emulator -list-avds 2>/dev/null)" ] && ! $(ANDROID_SDK)/platform-tools/adb devices | grep -q "device$$"; then \
		echo "No virtual device yet. Create one in Android Studio: More Actions > Virtual Device Manager."; \
		exit 1; \
	fi
	@ANDROID_HOME="$(ANDROID_SDK)" PATH="$(ANDROID_SDK)/platform-tools:$(ANDROID_SDK)/emulator:$$PATH" \
		$(MAKE) --no-print-directory dev \
		FRONTEND_CMD="EXPO_PUBLIC_API_URL=http://10.0.2.2:8080/api npx expo start --android"

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

# Everything the app saves lives in one SQLite database, backend/data/app.db.
reset-data:
	rm -f backend/data/app.db backend/data/app.db-wal backend/data/app.db-shm
	@echo "Saved data removed. The app starts empty on the next backend start."
