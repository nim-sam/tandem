---
name: Sentier
description: A day drawn as one trail on soft charcoal, with a single gold field that says when to leave.
colors:
  gold: "#E0AE3A"
  on-gold: "#1B1B1B"
  gold-container: "#3D3214"
  on-gold-container: "#EBD597"
  teal: "#6FB8B0"
  teal-container: "#203B39"
  on-teal-container: "#B5DCD8"
  vermilion: "#DE9584"
  vermilion-container: "#4E2A23"
  on-vermilion-container: "#EFCFC7"
  ground: "#1B1B1B"
  surface: "#222222"
  surface-high: "#2C2C2C"
  ink: "#D2D2D2"
  muted: "#A0A0A0"
  outline: "#666666"
  hairline: "#343434"
  rail: "#3E3E3E"
  gold-text-light: "#7A5B14"
  gold-container-light: "#F3E2AE"
  teal-light: "#2A7770"
  teal-container-light: "#D3E8E5"
  on-teal-container-light: "#16403C"
  vermilion-light: "#A9503B"
  vermilion-container-light: "#F3DAD3"
  on-vermilion-container-light: "#4A1F15"
  ground-light: "#EFEFEF"
  surface-light: "#F8F8F8"
  surface-high-light: "#E4E4E4"
  ink-light: "#2E2E2E"
  muted-light: "#626262"
  outline-light: "#949494"
  hairline-light: "#D9D9D9"
  rail-light: "#CFCFCF"
  line-walk: "#8A8A8A"
  line-bus: "#2E9BE0"
  line-metro: "#EF8122"
  line-rem: "#8BC53F"
  line-bike: "#B07CE8"
  line-train: "#C98F5A"
typography:
  display:
    fontFamily: "Barlow Semi Condensed, sans-serif"
    fontSize: "56px"
    fontWeight: 700
    lineHeight: "58px"
    letterSpacing: "0"
    fontFeature: "tnum"
  headline:
    fontFamily: "Barlow Semi Condensed, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: "36px"
    letterSpacing: "0"
  title-large:
    fontFamily: "Barlow Semi Condensed, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: "28px"
    letterSpacing: "0"
  title:
    fontFamily: "Barlow Semi Condensed, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: "24px"
    letterSpacing: "0"
  title-small:
    fontFamily: "Barlow Semi Condensed, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: "22px"
    letterSpacing: "0"
  body:
    fontFamily: "Roboto, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
    letterSpacing: "0.25px"
  body-small:
    fontFamily: "Roboto, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
    letterSpacing: "0.4px"
  label:
    fontFamily: "Roboto, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: "20px"
    letterSpacing: "0.1px"
  label-small:
    fontFamily: "Roboto, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: "16px"
    letterSpacing: "0.5px"
rounded:
  field: "2px"
  tag: "4px"
  pill: "6px"
  block: "8px"
  control: "10px"
  nav-pill: "15px"
spacing:
  hair: "4px"
  tight: "6px"
  row: "8px"
  inline: "10px"
  group: "12px"
  section: "16px"
  gutter: "20px"
components:
  event-block:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    rounded: "{rounded.block}"
    padding: "10px 14px"
  leave-pill:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.on-gold}"
    typography: "{typography.headline}"
    rounded: "{rounded.pill}"
    padding: "4px 12px"
  stop-dot:
    backgroundColor: "{colors.ground}"
    rounded: "6px"
    size: "12px"
  nav-destination-selected:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.on-gold}"
    rounded: "{rounded.nav-pill}"
    width: "56px"
    height: "30px"
  nav-bar:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted}"
    typography: "{typography.label-small}"
    height: "72px"
  button-primary:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.on-gold}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
  fab:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.on-gold}"
    rounded: "{rounded.block}"
    size: "56px"
  chip-selected:
    backgroundColor: "{colors.teal-container}"
    textColor: "{colors.on-teal-container}"
    typography: "{typography.label}"
    rounded: "{rounded.tag}"
  text-field:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
  error-strip:
    backgroundColor: "{colors.vermilion-container}"
    textColor: "{colors.on-vermilion-container}"
    typography: "{typography.body}"
    padding: "10px 20px"
---

# Design System: Sentier

## Overview

**Creative North Star: "Sentier, night"**

The day is one trail. Events are bordered blocks; between two blocks runs a single vertical line with a small dot wherever the rider changes mode, labelled like a trail marker with the station or stop. The ground is neutral charcoal with no tint, and one flat gold field per trip says when to leave. Contrast is deliberately moderate: a mid charcoal ground, soft grey ink and slightly desaturated accents, with body text still above 4.5:1. Everything the rider does not need in the first few seconds waits behind "Details" and opens in place.

It is an Android-first Material 3 app (react-native-paper) and keeps Material's controls, navigation bar and touch targets. What is its own is the trail, the three-job colour scheme and the sign-style condensed face on times, headings and stop names. Dark is the designed scheme and the default; a light scheme with the same colour jobs is selectable in Settings (dark, light, or follow the phone) for direct sunlight.

The surface is flat. Sections are separated by hairlines and space, not by filled cards. Motion happens only when the user changes state.

**Key Characteristics:**
- Lightly bordered event blocks joined by one vertical line; a dot and a name at each change of mode.
- The day starts and ends at a round marker (a house for home), not at a block: home is a place, not an event.
- One gold field per commute: "Leave HH:MM".
- Teal for offers and good news, vermilion for warnings, each transit line in its agency's colour.
- Condensed sign face for times, headings and stop names; platform face for body and controls.
- Flat charcoal grounds, hairline rules, no authored shadows.
- Detail on request, in place; nothing animates on load.

## Colors

Neutral charcoal carries the screen; three colours each have one job, and transit lines bring their own.

### Primary
- **Trail Gold** (`gold`, #E0AE3A, ink `on-gold`): the flat field. It fills the "Leave HH:MM" pill, the pill behind the selected navigation destination, today in the calendar (the date's disc and the current-time line), and the primary action (the add-event button, a screen's one committing button). The field is the same gold in both schemes. In the light scheme, gold used as a text or control colour becomes **Deep Gold** (`gold-text-light`) because the field colour is unreadable as text on white.

### Secondary
- **Patina Teal** (`teal`; `teal-light` in light): offers and positive state. The free-time line above a departure, "on time", the green-walk bars and icons, the heading of places that fit a gap. Its container (`teal-container`) is the selected state of choices: an active filter chip and the chosen segment of a segmented control.

### Tertiary
- **Vermilion** (`vermilion`; `vermilion-light` in light): warnings only. Late vehicles, stairs, a trip that does not fit between two events, offline demo data, a location that could not be found, simulated step data. It is also the Material error role, so the inline error strip uses its container pair.

### Neutral
- **Charcoal Ground** (`ground`): the page, the top bar, the inside of event blocks and stop dots.
- **Raised Charcoal** (`surface`): the navigation bar and Material overlays.
- **High Charcoal** (`surface-high`): map placeholder and the highest tonal step.
- **Light Ink** (`ink`): text, the stop dot ring.
- **Outline** (`outline`): the event block border, the endpoint marker ring, calendar event blocks and the dashed travel blocks.
- **Muted Ink** (`muted`): secondary text, walking labels, durations, the dotted walk line, unselected navigation.
- **Hairline** (`hairline`): section rules, the top bar and navigation bar edges.
- **Rail** (`rail`): the plain 2dp line that carries the trail past the free-time line, the leave field and "Details".
- Light scheme: the same roles on `ground-light`, `surface-light`, `ink-light`, `muted-light`, `hairline-light`, `rail-light`.

### Line colours
Each vehicle segment is drawn in the colour the agency publishes for that line. When none is published the mode fallback applies (`line-bus`, `line-metro`, `line-rem`, `line-train`, `line-bike`). A colour that would vanish against the ground is pulled toward the ink: in dark, colours with relative luminance under 0.12 are mixed 45% toward white; in light, colours over 0.7 are mixed 35% toward black.

### Named Rules
**The One Gold Field Rule.** A commute has exactly one gold field, and it is the time to leave. Elsewhere gold marks only where you are (selected destination) and the one thing to commit (primary action). Gold is never a text highlight on the dark ground and never decoration.

**The Three Jobs Rule.** Gold says go, teal offers, vermilion warns. A colour never borrows another's job, and a warning always carries an icon or words as well as vermilion.

**The Agency's Colour Rule.** A vehicle segment is the line's own colour, never a theme colour. Only contrast against the ground may adjust it.

## Typography

**Display Font:** Barlow Semi Condensed 700 Bold and 600 SemiBold (loaded as separate font files; the first frame is held on the ground colour until they are ready)
**Body Font:** the platform face (Roboto on Android), at react-native-paper's Material 3 defaults

**Character:** A wayfinding-sign condensed face for what is read at a glance (times, headings, stop names) against a plain platform face for everything read as a sentence or pressed as a control.

### Hierarchy
- **Display** (700, 56/58, tabular): one large figure per screen at most; today's step count.
- **Headline** (700, 28/36): the screen title in the top bar and the time inside the leave pill.
- **Title Large** (600, 22/28): section headings inside a screen.
- **Title** (600, 18/24): event titles, the word "Leave", day headings, stat lines.
- **Title Small** (600, 16/22): stop and station names with their times, event time ranges, alternative routes.
- **Body** (400, 14/20): places, line names with walking labels, reasons, form text. The date beside the screen title.
- **Body Small** (400, 12/16): durations, stop counts, passed stops, free-time line, estimates and notes.
- **Label** (500, 14/20): buttons, chips, small list headings.
- **Label Small** (500, 12/16): navigation labels, chart axis labels.

### Named Rules
**The Sign Face Rule.** The condensed face is for times, headings and stop names. Sentences and control labels stay in the platform face.

**The One File Per Weight Rule.** Each condensed weight is its own font file. Pick the weight by choosing the variant; never set a font weight on a condensed variant. Letter spacing on the condensed face is 0.

**The Tabular Times Rule.** Every clock time, duration and count that sits in a column or changes in place uses tabular numerals.

## Layout

One column, phone first. Screen content has a 20dp gutter, a 16dp gap between sections and 96dp of bottom padding so the last row clears the add button; content is capped at 720dp and centred on wide windows. The top bar sits on the ground colour with the title and its subtitle on one baseline (the date beside "Today", never above it), actions at the right, a hairline beneath, minimum height 64dp plus the status-bar inset. The navigation bar is 72dp plus the bottom inset, five destinations.

The day view manages its own gutter. An event block spans the column. The trail leaves from under the block 12dp in from its left edge, in a 28dp-wide rail column; labels start 8dp right of the rail. Trail rows have no gaps between them so the line is continuous from block to block.

Rhythm inside rows uses 4, 6, 8, 10 and 12dp. Anything tappable is at least 48dp tall; list rows with a trailing action are at least 56dp. Long names truncate to one line (two for event titles and places) rather than wrapping the trail.

## Elevation & Depth

Flat. The app's own styles declare no shadows. Depth is tonal: ground, raised and high charcoal (Material's elevation levels are remapped to flat charcoal steps #222222 to #343434, and to near-whites in light). Separation between sections is a hairline rule or space. Material overlays supplied by the component library (dialogs, menus, snackbars, the add button) keep their stock elevation and scrim (`rgba(0,0,0,0.5)`).

### Named Rules
**The Hairline Rule.** Group with a hairline and space. A filled, raised card around a section or a commute is not part of this system.

## Shapes

Corners are small and squared-off, like signage. Text fields are nearly square (2dp); tags and chips 4dp; the leave pill 6dp; event blocks, the map frame and the add button 8dp; buttons and segmented controls 10dp. The only full rounds are the stop dot (12dp circle, 2dp ink ring, ground fill) and the selected-destination pill (56 by 30dp).

Borders do the structural work: the event block has a 1dp border in the outline colour and no fill; the map frame a 1dp border; rules are one hairline. The trail has four strokes: a plain 2dp rail, a 3dp dotted line in muted ink for walking, a 4dp solid line with 2dp round ends in the line's colour for a vehicle, and a 6 by 2dp tick for each stop a vehicle passes.

## Components

### Event block
The anchor of the day view. A 1dp outline-colour border, 8dp corners, no fill, padding 10 by 14dp, minimum 48dp. Title (Title, up to two lines) with the time range right-aligned on the same baseline (Title Small, tabular); the place beneath in muted Body. A place that could not be located is stated in words in vermilion. Tapping the block opens the event's details read-only (time, date, place and address, description, where it came from); a pencil in that dialog switches the same dialog to editable fields, and a bin deletes after a confirmation.

### Day endpoints
Where the day starts and ends. Not events, so not blocks: a 44dp round marker with a 1dp outline ring, centred on the trail's rail, with the place name in Title, its address in muted Body Small and, at the right in muted Title Small, "leave HH:MM" (start) or "arrive HH:MM" (end), both taken from the commute. Home shows a house; any other place shows the icon that suits it (briefcase, cup, tree, school, bed, train, or a map pin), never a house. With no home set the ring is dashed and the marker asks for one. Tapping a marker opens a dialog to type an address or pick a saved place for that day, with a switch to make it the home for every day and, when the day is not at home, "Back to home".

### The trail (signature)
The trip between two blocks, top to bottom:
- **Free-time line** (only with 10 minutes or more spare and a place that fits): one teal Body Small line, "31 min free · place" with "+4 min" or "on your way" at the right. One line, never a prompt.
- **Leave field:** the gold pill, "Leave" in Title and the time in Headline, both in `on-gold`; beside it in muted Body, the duration and arrival time. A warning, if any, sits under it with an alert icon in vermilion.
- **Segments:** dotted for walking ("Walk" or "Walk via <park>", muted), solid in the line's colour for a vehicle (line name in ink, then minutes and stop count in muted Body Small, then "on time" in teal or "N min late" in vermilion, then a stairs icon in vermilion with a spoken label when the leg is not step-free).
- **Stop dots:** at every change of mode, the station or stop name in Title Small with its time at the right. Bus stops add the number printed on their sign ("stop 52369") in muted Body Small.
- **Transfer walks** of 5 minutes or less between two vehicles are not drawn; the dot already says "change here". The first and last walks are always drawn.
- **Passed stops:** tapping a vehicle segment (48dp target, chevron at the right) lists the stops it passes, each with a tick in the line's colour, name, stop number for buses, and time.
- **Details:** a text button in ink with a chevron, "Details · N other options". It opens in place: the reason for this route, estimates (CO2 labelled as an estimate, steps, step-free or has stairs, weather), places that fit the free time under a teal Label heading, the route map (220dp, 8dp corners, 1dp border), and other routes as hairline-separated rows (56dp minimum) that replace the trail when tapped.

Opening, closing and re-laying the trail eases over 200ms, ease-out, with content fading in; it is instant when the system's remove-animations setting is on. Nothing animates on load.

### Calendar
Three views behind a segmented control: Day, Week, Month. Week and Month are for looking around and do not plan routes; opening a day does.
- **Month:** seven columns, Monday first, hairline between weeks. Day numbers in Title Small; days outside the month in muted ink; today on a 28dp gold disc. On a phone each event is a 6dp dot (three at most, then "+N"); from 600dp wide, up to three lines of "HH:MM title". Tapping a day opens it in Day.
- **Week and Day:** an hour grid, 52dp per hour, hour labels in a 44dp gutter, hairline rules. Hours before 07:00 are left out unless something is planned in them. Events are blocks on the high charcoal with a 1dp outline border and 6dp corners; overlapping events share the width side by side; events of 23 hours or more sit in an "all day" row. Today has a 2dp gold line at the current time. Tapping an empty hour starts a new event at that hour.
- **Day** also draws the day's commutes between the events as dashed outline blocks (never gold): an icon (the endpoint's icon for the trips from and to the day's endpoints), then "HH:MM–HH:MM · lines". Tapping one opens the full trail on the Day tab.

### Buttons
- **Primary:** gold fill, `on-gold` label, 10dp corners; one per screen or dialog.
- **Tonal** (import, connect): Material tonal button on the teal container.
- **Outlined** and **Text:** secondary and inline actions; text buttons in ink when they sit on the trail.
- **Add button:** gold, 8dp corners, plus icon in `on-gold`, fixed 16dp from the bottom-right.

### Chips and segmented controls
Unselected is outlined; selected fills with the teal container and its on-colour, with the state also written in the label ("Green routes on"). No check mark on the day view's filter chip.

### Inputs
Outlined Material text fields, 2dp corners, label on the outline. Dialogs are capped at 520 to 560dp wide and 92% of the window, fields 10dp apart.

### Navigation
Material 3 navigation bar on raised charcoal with a hairline top edge. Five destinations: 22dp icon inside a 56 by 30dp pill, Label Small beneath. Selected: gold pill, `on-gold` icon, ink label. Unselected: no pill, muted icon and label.

### Screen frame
Title in Headline with optional muted Body subtitle beside it; icon-button actions at the right. Errors appear as a full-width strip under the bar on the vermilion container with an icon, the message and "Retry". Pull-to-refresh where a screen loads data.

### Lists and sections
Section heading in Title Large; rows at least 56dp; sections end in a hairline. Meters are thin rounded tracks (8 to 10dp tall): teal for learned or green measures.

## Do's and Don'ts

### Do:
- **Do** give each commute exactly one gold field, the time to leave, with duration and arrival beside it in muted ink.
- **Do** draw the trip as one continuous vertical line: dotted for walking, solid in the agency's line colour for a vehicle, a 12dp ringed dot with the stop name at each change of mode.
- **Do** show the stop number on bus stops, and only on bus stops.
- **Do** keep reasons, estimates, places, the map and other options behind "Details", opened in place.
- **Do** set times, headings and stop names in Barlow Semi Condensed with tabular numerals for times; everything else in the platform face.
- **Do** pair every vermilion warning with an icon or words, and label estimates and simulated data as such.
- **Do** keep every tap target at least 48dp tall.
- **Do** keep the same colour jobs in the light scheme, with the deeper text-safe gold, teal and vermilion.
- **Do** ease layout changes over 200ms ease-out and respect the remove-animations setting.

### Don't:
- **Don't** put a second gold field on a commute, or use gold for emphasis, icons or decoration.
- **Don't** stack commutes or sections as filled, rounded, elevated cards.
- **Don't** write step-by-step instruction sentences on the trail; a segment is a line name, a duration and a stop count.
- **Don't** draw transfer walks of 5 minutes or less between two vehicles.
- **Don't** recolour a transit line with a theme colour.
- **Don't** set a font weight or letter spacing on a condensed variant.
- **Don't** add shadows in app styles, or animate anything on load.
- **Don't** show a product name; none exists.
