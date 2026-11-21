# EcoCommute - Daily Timeline & UI Concept

## The "ONE Day in the UI" Visualization

The user experience centers on the **Daily Intermodal Timeline (`DayTimeline.tsx`)**. Rather than isolating calendar events and transit directions into separate apps, EcoCommute weaves them into a unified chronological day stream.

```
+-------------------------------------------------------------------+
|  [Header] EcoCommute               [Switch: Touch Grass 🌱 ON]    |
+-------------------------------------------------------------------+
|  [Time-to-Leave Banner]                                           |
|  ⏰ Leave in 12 mins to reach McGill McConnell Hall               |
|  Next step: Walk 7 mins to McGill Metro Station                   |
+-------------------------------------------------------------------+
|  [Daily Eco & Health Ticker]                                      |
|  🍃 0.96 kg CO2 Saved  •  🌲 1.6 Tree-Days  •  👟 2,800 Steps     |
+-------------------------------------------------------------------+
|                                                                   |
|  [09:00 - 10:30]  EVENT 1: Software Architecture Lecture          |
|                   Location: McConnell Hall, McGill [Google Sync]  |
|                                                                   |
|       |                                                           |
|       |  === TRANSIT COMMUTE: 34 MINS (2 Transfers) ===           |
|       |                                                           |
|       +--- (🚶 Walk: 7 mins) ------------------------------------+ |
|       |    Through university green corridor                     |
|       |    [Elevator Accessible] [🌱 Nature Trail] [805 steps]    |
|       |                                                           |
|       +--- (🚇 STM Metro: 12 mins) ------------------------------+ |
|       |    Orange Line towards Gare Centrale                     |
|       |    [Elevator Accessible: Yes]                             |
|       |                                                           |
|       +--- (🚆 CDPQ REM: 15 mins) -------------------------------+ |
|       |    Intermodal Switch at Gare Centrale -> Brossard Branch  |
|       |    [100% Accessible: Working Elevators Available]         |
|       |                                                           |
|       v                                                           |
|                                                                   |
|  [12:00 - 14:00]  EVENT 2: AI Sprint Planning                     |
|                   Location: Mila Quebec AI Institute              |
|                                                                   |
+-------------------------------------------------------------------+
|  [Bottom Navigation Bar]                                          |
|  📅 Today   |   🗓️ Calendar   |   📍 Places   |   👟 Health       |
+-------------------------------------------------------------------+
```

---

## Key UI Concepts & Features

### 1. Intermodal Nodes (Multi-Modal Switches)
Each commute is decomposed into discrete `IntermodalNode` elements:
- **Mode Identification**: Color-coded and icon-distinguished (Green for Walk, Orange for STM Metro, Teal for CDPQ REM, Blue for Bus).
- **Elevator Accessibility Indicator**: Real-time status badge showing whether the station has operating elevators, allowing commuters with mobility requirements, strollers, or heavy luggage to travel with peace of mind.
- **Active Step Count**: Steps accumulated on walking legs are recorded and credited toward the user's daily fitness goal.

### 2. "Touch Grass" Mode (Nature-Focused Detours)
- Users can toggle **Touch Grass** mode directly from the top bar.
- When enabled, the routing engine reroutes walking segments through urban green spaces (e.g. Mount Royal Park, Lachine Canal, Parc La Fontaine) and suggests **third places** (parks, coffee libraries, outdoor study sanctuaries) with amenities like seating and Wifi.

### 3. Time-to-Leave Notification Engine
- The system automatically factors in:
  - Event Start Time
  - Transit Route Duration
  - Walking time to the initial station
  - User's personal buffer margin
- Shows clear alerts: *"Leave in 14 minutes — board Metro Orange Line at Bonaventure"*.

### 4. Wearable Health Integration (Fitbit / Garmin)
- Displays commute-derived step counts separately from general movement.
- Computes cardiovascular minutes and calories burned purely during transit transitions.
