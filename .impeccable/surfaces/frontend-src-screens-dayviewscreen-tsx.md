---
version: 1
slug: "frontend-src-screens-dayviewscreen-tsx"
primary_target: "frontend/src/screens/DayViewScreen.tsx"
related_targets: ["frontend/src"]
---

# Surface brief: the app (day view leads)

Scope: all five tabs of the mobile app; the day view is the primary surface. Visitor mode: Operate.

Audience and job: a Montréal transit rider, phone in one hand, a few seconds of attention, at home before leaving or between appointments. They need: when to leave, how to get there, what fits in the gap.

Constraints: Android-first Material 3 controls and navigation (react-native-paper); dark by default with a light option in Settings; all existing behaviour, API calls and accessibility labels stay; estimates and simulated data stay labelled; no product name in the UI.

## Direction contract (superseded history; see "User-directed redesign (2026-11-21)" below)

Everything in this section, including the constraint above that the app is dark by default, describes the earlier world. It is kept as history and no longer governs the build.

THESIS: The day is one line. Events are bordered blocks; out of each block runs a single vertical line to the next, with a small dot at every change of mode, labelled with the station or stop. The one gold field is when to leave. Refused: the maps-app stack of identical rounded cards, and step-by-step instruction sentences.

OWN-WORLD: Neutral charcoal grounds (#111111 ground, #1A1A1A raised, #262626 high), light ink #E8E8E8, muted #B3B3B3. One gold #F7B500 flat field, used only for the leave pill, the selected tab and the primary action. Patina teal #5CC5BC for offers and positive state. Vermilion #F2907A for warnings only. Line segments in each agency's line colour; solid for a vehicle, dotted for walking. Sign-style condensed face (Barlow Semi Condensed) for headings, times and stop names; platform face for body and controls. Light scheme keeps the same roles.

STORY: The rider sees their events and, between them, when to leave and which stations they pass through. Details (why this route, CO2, steps, places that fit the free time, map, other options) open in place on request. Spare time is one teal line, never a nag.

FIRST VIEWPORT: Top bar with "Today" and the date beside it, day controls right. A "Green routes" chip and the day's totals. Then: event block (2dp border, title, time range, place); under it the line: teal free-time line, gold "Leave 11:15" pill with duration, dotted walk, dot + station name + time, coloured segment + line name + minutes, repeated; a "Details" control; next event block. Transfer walks of 5 minutes or less between consecutive lines are not drawn. Bottom navigation bar, 5 destinations, gold pill on the selected one. Gold FAB adds an event.

Signature interaction: "Details" unfolds the route in place (reason, facts, places, map, other options); choosing another option re-lays the line. Motion grammar: state changes only, 200 ms ease-out; nothing animates on load.

User-directed revision (after the first build): the user called the trail-with-time-column version cluttered and specified the block-line-dot layout above, short labels only, no transfer walks.

User-directed revision (2026-11-21): the colour scheme is now minimal, with shades of blue as the only accent (blue for where you are and what to commit, a paler blue for offers and good news) on the unchanged neutral grounds; vermilion is kept for warnings. The bottom navigation bar now floats: a fully rounded bar inset from the screen edges, content scrolling behind it, the selected destination on a blue pill. The earlier gold "Leave" pill had already been removed at the user's request; leave and arrive times are plain text. Colour names and values above this paragraph are the earlier direction and are kept as history; DESIGN.md records the current system.

FORM: grounded candidate 6 of 7 (park trail markers), steered by the user to dark-first with Impeccable's charcoal/gold/patina colouring. seed:b7af9b70e2242801

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## User-directed redesign (2026-11-21)

The visual world was replaced at the user's request, not polished. The earlier direction contract above (dark neutral grounds, a sign-style typeface for times and headings, flat surfaces separated by thin lines, small squared corners) is superseded and kept only as history. DESIGN.md records the current system; this section is the governing direction for the surface.

The brief, as the user gave it:
- Clean, minimalist, mobile-first, calm and approachable.
- Soft, generously rounded corners; rounded white cards on an ice-blue ground with subtle shadows; layered surfaces.
- A modern sans-serif with clear hierarchy; minimalist line icons; a floating pill navigation bar.
- A strict monochromatic blue accent system: Primary #234F91, Deep #163866, Medium #5279B8, Soft #A9BDE0, Pale #DFE8F7, Ice #F1F5FC, White #FFFFFF, with neutral grey used sparingly. Blue is the only accent; depth comes from tonal contrast; no gradients or decoration.

Decisions the user made when asked (2026-11-21):
1. Transit lines keep their agencies' own colours, but only on the small line pills and on that line's stretch of the route, because riders recognise lines by colour. This is data, not an accent.
2. Warnings and errors keep a muted red (light #B4483F, dark #E79C94, with containers), always paired with an icon or words. It is the single non-blue UI colour.
3. Light is the default theme; a navy dark theme from the same blue family remains selectable in Settings (dark / light / system).

How it landed on this surface (the Day view): the day's totals and the green-routes switch are the screen's one deep-blue card. Day endpoints are white round markers with a blue icon. Events are white cards with the time range in a pale pill tag and a line-icon location row. Between cards the trail runs on the ice ground: a dotted soft-blue line with a pale walk pill for walking, a solid agency-colour line with a line pill for vehicles, ringed blue dots at stops, a pale pill for the free-time offer, and "Details" in blue opening a white card with the reason, estimates, map and other options. A white floating pill navigation bar (68dp, 14dp inset) and a round blue add button sit over the content. Type is Figtree in four weights.

Unchanged from before: the trail's structure and behaviour (block, line, dot at each change of mode; transfer walks of 5 minutes or less not drawn; details open in place; 200 ms ease-out on state changes only), the Android-first react-native-paper (Material Design 3) kit, all behaviour, API calls and accessibility labels, labelled estimates and simulated data, and no product name in the UI.
