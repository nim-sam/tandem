# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

## Users

People in greater Montreal who get around by public transit (STM metro and bus, REM, exo, RTL/STL) and keep their day in a calendar. Not specifically students. They check the app at home before leaving and on the move between appointments, often one-handed and with only a few seconds of attention.

Their job: know when to leave for the next thing, how to get there, and what to do with the time in between.

## Product Purpose

A day planner that joins a calendar with public-transit routing. For each pair of consecutive events at different places it plans the trip, tells the user when to leave, and uses spare time to suggest a greener walk or a nearby place to stop.

Success is the user arriving on time without opening a separate maps app, and choosing a walk or a stop they would not otherwise have taken.

## Positioning

Routes are planned from the calendar, not from a search box: the app already knows where the user has to be and when, so "time to leave" and "you have 45 minutes free" come for free. Routes are ranked for the individual (stated preferences plus what they actually pick), and scored on green space, emissions and step-free access, not only speed.

## Operating Context

- Public transit only. No car routing.
- Calendar comes from `.ics` import, Google Calendar, or events typed in.
- A commute is a sequence of legs; every change of mode (walk, bus, metro, REM, train) is one step the user must see.
- Local "time to leave" notifications.
- Used outdoors, in stations and in transit, in daylight and at night.

## Capabilities and Constraints

- Live: transit itineraries with alternatives, leave-at times, per-leg detail, route map, CO2 saved versus driving, step counts, green-space share of walks, park-walk option, third-place suggestions that fit free time, weather-aware suggestions, saved places in collections, weekly totals and a green-walk streak, mode preferences, a view of what the ranking has learned.
- Step counts: the phone's pedometer is real. Fitbit and Garmin are placeholders and must be labelled as such.
- Google Calendar sync is real only when OAuth client IDs are configured; otherwise it loads labelled demo events.
- Routes from the offline fallback are not real directions and must be labelled.
- Station elevator data is static (a station has elevators), not live outage data.
- CO2 and step figures on routes are estimates and planned values, not measurements.
- Single user; no accounts.
- Built with React Native (Expo) and Material components. Runs on Android, iOS and web from one codebase; Android is the reference.
- Product name: undecided. Do not feature a name in the UI.

## Evidence on Hand

- Real schedule data via Transitous; real OpenStreetMap parks (about 2,100) and third places (about 1,500); real STM station accessibility list.
- No logo, no brand assets, no testimonials, no usage numbers. None may be invented.

## Product Principles

1. The next departure is the most important thing on screen.
2. Say what is real and what is estimated or simulated, every time.
3. Suggest, never nag: green walks and stops are offers that fit the user's time.
4. The user's own choices outrank the app's ranking.
5. Accessibility information is route-critical, not decoration.

## Accessibility & Inclusion

Step-free routing is a core feature, so riders with mobility needs are primary users, not an edge case. Elevator and accessible-vehicle status must be readable at a glance and never conveyed by colour alone. Text must stay legible outdoors and at large system font sizes.
