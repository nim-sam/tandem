---
name: Sentier
description: A calm day planner in one hue, with rounded white cards on an ice-blue ground and a floating pill navigation bar.
colors:
  primary: "#234F91"
  deep: "#163866"
  medium: "#5279B8"
  soft: "#A9BDE0"
  pale: "#DFE8F7"
  ice: "#F1F5FC"
  white: "#FFFFFF"
  offer: "#456DAD"
  rail: "#C5D2E8"
  on-deep-muted: "#C3D2EC"
  ink: "#14243D"
  muted: "#5B6B84"
  outline: "#A7B4C9"
  hairline: "#E1E7F1"
  warn: "#B4483F"
  warn-container: "#F8E4E1"
  on-warn-container: "#5A1B15"
  primary-dark: "#A9BDE0"
  on-primary-dark: "#10294D"
  deep-dark: "#223F70"
  offer-dark: "#8FA9D6"
  soft-dark: "#3A5384"
  pale-dark: "#20304D"
  rail-dark: "#35476A"
  ground-dark: "#0D1626"
  surface-dark: "#162338"
  surface-bar-dark: "#213252"
  ink-dark: "#E4EAF5"
  muted-dark: "#9DABC4"
  outline-dark: "#4A5C7C"
  hairline-dark: "#24344F"
  warn-dark: "#E79C94"
  on-warn-dark: "#4A1712"
  warn-container-dark: "#4D2824"
  on-warn-container-dark: "#F6D5D1"
  line-walk: "#8A8A8A"
  line-bus: "#2E9BE0"
  line-metro: "#EF8122"
  line-rem: "#8BC53F"
  line-bike: "#B07CE8"
  line-train: "#C98F5A"
typography:
  display:
    fontFamily: "Figtree, sans-serif"
    fontSize: "48px"
    fontWeight: 700
    lineHeight: "54px"
    letterSpacing: "0"
    fontFeature: "tnum"
  headline:
    fontFamily: "Figtree, sans-serif"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: "32px"
    letterSpacing: "0"
  headline-small:
    fontFamily: "Figtree, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: "28px"
    letterSpacing: "0"
  title-large:
    fontFamily: "Figtree, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: "26px"
    letterSpacing: "0"
  title:
    fontFamily: "Figtree, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: "24px"
    letterSpacing: "0"
  title-small:
    fontFamily: "Figtree, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: "20px"
    letterSpacing: "0"
  body-large:
    fontFamily: "Figtree, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "24px"
    letterSpacing: "0"
  body:
    fontFamily: "Figtree, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "21px"
    letterSpacing: "0"
  body-small:
    fontFamily: "Figtree, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "18px"
    letterSpacing: "0"
  label-large:
    fontFamily: "Figtree, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: "20px"
    letterSpacing: "0"
  label:
    fontFamily: "Figtree, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: "18px"
    letterSpacing: "0"
  label-small:
    fontFamily: "Figtree, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: "16px"
    letterSpacing: "0"
rounded:
  tag: "8px"
  control: "14px"
  block: "16px"
  card: "22px"
  pill: "999px"
spacing:
  gap: "14px"
  card: "18px"
  gutter: "20px"
components:
  card:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "18px"
  card-pale:
    backgroundColor: "{colors.pale}"
    textColor: "{colors.deep}"
    rounded: "{rounded.card}"
    padding: "18px"
  card-deep:
    backgroundColor: "{colors.deep}"
    textColor: "{colors.white}"
    rounded: "{rounded.card}"
    padding: "18px"
  event-card:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    rounded: "{rounded.card}"
    padding: "16px 18px"
  time-tag:
    backgroundColor: "{colors.pale}"
    textColor: "{colors.deep}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  endpoint-marker:
    backgroundColor: "{colors.white}"
    textColor: "{colors.primary}"
    rounded: "{rounded.pill}"
    size: "44px"
  line-pill:
    typography: "{typography.label-large}"
    rounded: "{rounded.tag}"
    height: "24px"
    padding: "0 7px"
  walk-pill:
    backgroundColor: "{colors.pale}"
    textColor: "{colors.primary}"
    rounded: "{rounded.tag}"
    height: "24px"
    padding: "0 7px"
  stop-dot:
    backgroundColor: "{colors.white}"
    textColor: "{colors.primary}"
    rounded: "{rounded.pill}"
    size: "12px"
  free-time-pill:
    backgroundColor: "{colors.pale}"
    textColor: "{colors.deep}"
    typography: "{typography.body-small}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
  details-card:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.block}"
    padding: "16px"
  nav-bar-floating:
    backgroundColor: "{colors.white}"
    textColor: "{colors.muted}"
    typography: "{typography.label-small}"
    rounded: "{rounded.pill}"
    height: "68px"
    padding: "8px 6px"
  nav-destination-selected:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.white}"
    rounded: "{rounded.pill}"
    width: "52px"
    height: "30px"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.white}"
    typography: "{typography.label-large}"
    rounded: "{rounded.pill}"
  button-tonal:
    backgroundColor: "{colors.pale}"
    textColor: "{colors.deep}"
    typography: "{typography.label-large}"
    rounded: "{rounded.pill}"
  button-text:
    textColor: "{colors.primary}"
    typography: "{typography.label-large}"
    rounded: "{rounded.pill}"
  fab:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.white}"
    rounded: "{rounded.pill}"
    size: "56px"
  chip-selected:
    backgroundColor: "{colors.pale}"
    textColor: "{colors.deep}"
    typography: "{typography.label-large}"
    rounded: "{rounded.tag}"
  text-field:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    typography: "{typography.body-large}"
    rounded: "4px"
  calendar-event:
    backgroundColor: "{colors.pale}"
    textColor: "{colors.deep}"
    typography: "{typography.title-small}"
    rounded: "10px"
    padding: "2px 8px"
  today-disc:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.white}"
    typography: "{typography.title-small}"
    rounded: "{rounded.pill}"
    size: "28px"
  error-card:
    backgroundColor: "{colors.warn-container}"
    textColor: "{colors.on-warn-container}"
    typography: "{typography.body}"
    rounded: "{rounded.block}"
    padding: "10px 8px 10px 16px"
---

# Design System: Sentier

## Overview

**Creative North Star: "One blue, in layers"**

The app is a quiet stack of surfaces in a single hue. The ground is ice blue, content sits on white cards with generously rounded corners and one soft shadow, selected and quiet states are pale blue, and each screen has at most one deep-blue card for the thing that matters most. Blue is the only accent; depth comes from tonal contrast between these layers. There are no gradients and no decoration.

This direction was set by the user on 2026-11-21 and replaced the previous visual world outright. The brief: clean, minimalist, mobile-first, calm and approachable; soft, generously rounded corners; rounded white cards on an ice-blue ground with subtle shadows; layered surfaces; a modern sans-serif with clear hierarchy; minimalist line icons; a floating pill navigation bar; and a strict monochromatic blue accent system (Primary, Deep, Medium, Soft, Pale, Ice, White), with neutral grey used sparingly.

Three decisions were made by the user on 2026-11-21 and are part of the system:
1. Transit lines keep their agencies' own colours, but only on the small line pills and on that line's stretch of the route, because riders recognise lines by colour. This is data, not an accent.
2. Warnings and errors keep a muted red, always paired with an icon or words. It is the single non-blue UI colour.
3. Light is the default theme. A navy dark theme from the same blue family remains selectable in Settings (dark, light, or follow the phone).

It is an Android-first app built with Expo and React Native. The UI kit is react-native-paper (Material Design 3) and the scheme is expressed through Material colour roles (primary, secondary, tertiary, error, background, surface, surfaceVariant, outline, elevation levels), so the kit's buttons, fields, switches, chips, dialogs and menus pick the scheme up without per-component styling. A small set of job-named tokens (`useTokens`: accent, offer, warn, deep, pale, soft, rail, muted, card) covers the places where a Material role name does not say enough.

What is the app's own: the day drawn as one trail between white event cards, the line pills, the three-tone card, the floating navigation bar and the Figtree type scale. Motion happens only when the user changes state.

**Key Characteristics:**
- Ice-blue ground, white cards at 22dp corners, one soft blue-tinted shadow.
- One accent hue. Every highlight, active state, chart and control is a shade or tint of the same blue.
- At most one deep-blue card per screen, for the screen's headline figures.
- Agency line colours on line pills and their stretch of route only; a muted red for warnings only.
- Figtree in four weights, each its own font file; clear steps from 26dp page titles to 12dp labels.
- Outline icons from Material Community Icons.
- A floating white pill navigation bar; the selected destination on a solid blue pill.
- Light by default; a navy dark theme with tonal depth and no shadows.
- Detail on request, in place; nothing animates on load.

## Colors

One blue family in seven steps carries the whole interface. Light values are the base tokens; the navy theme's values carry a `-dark` suffix.

### Primary
- **Primary Blue** (`primary`; `primary-dark` with ink `on-primary-dark` in dark): Material `primary`. Primary buttons, the add button, the selected navigation destination and its label, today's disc and the current-time line in the calendar, switches, focused field outlines, text buttons and links, the icon inside endpoint markers and the walk pill, the ring of stop dots, highlighted chart bars, the meter in "what the app has learned". In dark the role moves to the soft blue with deep-navy ink.
- **Deep Blue** (`deep`; `deep-dark` in dark): the emphasis card, and the ink on pale fills (Material `onPrimaryContainer`). Also the tint of the shadow and the inverse surface.
- **Medium Blue** (`medium`): Material `tertiary`. A supporting fill for the kit; the app's own styles reach for `offer` instead when the colour has to read as text.
- **Soft Blue** (`soft`; `soft-dark` in dark): tracks, the dotted walking line, dashed travel blocks in the calendar and the unhighlighted bars of a chart.
- **Pale Blue** (`pale`; `pale-dark` in dark): Material `primaryContainer`, `secondaryContainer`, `tertiaryContainer` and `surfaceVariant`. Selected states, time tags, the free-time pill, the walk pill, calendar event blocks, icon discs, meter tracks, tonal buttons, selected chips and segments.
- **Ice** (`ice`; `ground-dark` in dark): Material `background`. The page.
- **White** (`white`; `surface-dark` in dark): Material `surface` and, in light, every elevation level. Cards, markers, the navigation bar, dialogs, menus.

### Secondary
- **Offer Blue** (`offer`; `offer-dark` in dark): Material `secondary`, the medium blue deepened one step so it reads as text. Offers and good news as text and icons: "on time", the "found on the map" tick and line under an address, the heading of places that fit a gap.

### Tertiary
- **Muted Red** (`warn`; `warn-dark` in dark, with `warn-container` / `on-warn-container` and their dark counterparts): Material `error`. Late vehicles, stairs, a trip that does not fit between two events, offline demo data, a location that could not be found, sample step data, the delete action, and the error card under the screen title. Never used without an icon or words.

### Neutral
- **Ink** (`ink`; `ink-dark`): primary text; a near-black blue, not a grey.
- **Muted Ink** (`muted`; `muted-dark`): secondary text, idle navigation icons and labels, durations, hour labels; a desaturated blue-grey.
- **Outline** (`outline`; `outline-dark`): field outlines, the dashed ring of an unset endpoint, the dashed goal line of the chart.
- **Hairline** (`hairline`; `hairline-dark`): dividers inside a card only (list rows, calendar grid lines, the map frame, the address suggestion list).
- **Rail** (`rail`; `rail-dark`): the plain 2dp line that carries the trail past the free-time pill, the times line and "Details", and joins two events at the same place.
- **On-deep muted** (`on-deep-muted`; the soft blue in dark): secondary text on the deep card.

### Line colours
Each vehicle segment and its pill take the colour the agency publishes for that line. When none is published the mode fallback applies (`line-bus`, `line-metro`, `line-rem`, `line-train`, `line-bike`; `line-walk` is the neutral grey used for walking legs on the map). A colour that would vanish against the ground is adjusted for contrast only: in light, colours with relative luminance over 0.7 are mixed 30% toward black; in dark, colours under 0.12 are mixed 45% toward white. The code on a pill is ink or white, whichever reads better on the fill.

### Named Rules
**The Blue Only Rule.** Blue is the only accent. Every highlight, active state, chart, meter and control is a shade, tint or opacity of the same blue family. No second accent hue, no gradients, no decorative colour. Depth is made by tone: ice, white, pale, deep.

**The Agency's Colour Rule** (user decision, 2026-11-21). A transit line's own colour appears in exactly two places: its line pill and its stretch of the route, on the trail and on the map. It is data, not an accent. It is never used for a theme job, and a theme colour never recolours a line; only contrast against the ground may adjust it.

**The Muted Red Rule** (user decision, 2026-11-21). Warnings and errors use the muted red, the single non-blue colour in the interface, and always carry an icon or words as well. Red is never an accent, a brand colour or a chart series.

**The One Deep Card Rule.** A screen has at most one deep-blue card, holding its headline figures. Day: the day's totals plus the green-routes switch. Activity: today's steps. Calendar, Places and Settings have none.

**The Light First Rule** (user decision, 2026-11-21). Light is the default theme. The navy theme keeps the same roles from the same blue family and is chosen in Settings (dark, light, system).

## Typography

**Display Font:** Figtree (Bold 700, SemiBold 600)
**Body Font:** Figtree (Regular 400, Medium 500)

**Character:** One friendly geometric sans-serif does everything. Hierarchy comes from size and from four weights, not from a second face. Letter spacing is 0 throughout.

The four weights are loaded as four separate font files (`Figtree_400Regular`, `Figtree_500Medium`, `Figtree_600SemiBold`, `Figtree_700Bold`) and mapped onto react-native-paper's Material 3 type variants. The first frame is held on the ground colour until they are ready.

### Hierarchy
- **Display** (Bold, 48/54, tabular): one large figure per screen at most; today's step count on the deep card.
- **Headline** (Bold, 26/32): the page title.
- **Headline Small** (Bold, 22/28): dialog titles.
- **Title Large** (SemiBold, 20/26): section headings inside a card; the figures on the Day summary card.
- **Title** (SemiBold, 17/24): event titles, endpoint names, card titles, stat lines.
- **Title Small** (SemiBold, 15/20): stop and station names with their times, leave and arrive times, calendar day numbers.
- **Body Large** (Regular, 16/24): the date beside the page title, row titles in Settings and Places, field text.
- **Body** (Regular, 15/21): places, line names, reasons, helper sentences.
- **Body Small** (Regular, 13/18): durations, stop counts, passed stops, estimates and notes.
- **Label Large** (SemiBold, 15/20): buttons; small list headings; the code on a line pill (set Bold at 14dp).
- **Label** (Medium, 13/18): time tags, chart weekday labels.
- **Label Small** (Medium, 12/16): navigation labels (SemiBold when selected), hour labels, weekday headings, chart values.

### Named Rules
**The One File Per Weight Rule.** Each weight is its own font file. Choose the weight by choosing the variant or the `Font` family; never set `fontWeight` on text. Every variant declares weight 400 so the platform does not synthesise a second bold.

**The Tabular Times Rule.** Every clock time, duration and count that sits in a column or changes in place uses tabular numerals.

## Layout

One column, phone first. Screen content has a 20dp gutter, 14dp between cards and 18dp of padding inside a card; content is capped at 720dp and centred on wide windows. The page title sits directly on the ice ground, 16dp below the status-bar inset, with its subtitle on the same baseline (the date beside "Today", never above it) and icon-button actions at the right; there is no bar fill and no divider under it.

The navigation bar floats over the content: 68dp tall, inset 14dp from the screen edges and from the bottom system inset, capped at 520dp wide and centred on wide windows. Content scrolls behind it. Anything pinned to the bottom keeps the bar's 96dp clearance (68 + 14 + 14) plus the bottom inset: scroll content adds 96dp more bottom padding, the add button sits 18dp from the right just above the clearance, and snackbars are lifted by it.

The Day view manages its own gutter. An event card spans the column. The trail leaves from under the card 12dp in from its left edge, in a 28dp-wide rail column; labels start 8dp right of the rail. Trail rows have no gaps between them, so the line is continuous from card to card across the ice ground.

Anything tappable is at least 48dp tall; list rows with a trailing action are at least 56dp. Long names truncate to one line (two for event titles and places). Dialogs are capped at 520 to 560dp wide and 92% of the window, with fields 10dp apart.

## Elevation & Depth

Layered, and mostly tonal. In light, four tones do the work (ice ground, white card, pale fill, deep emphasis) and one soft shadow lifts white surfaces off the ground. In dark there is no shadow at all: depth is tonal, from the navy ground through the surface to Material's elevation steps (`#162338`, `#1A2941`, `#1E2E4A`, `#213252`, `#243759`); the navigation bar sits on the fourth step. In light every Material elevation level is white, so the kit's overlays do not pick up a tint. The dialog scrim is deep navy at 42% in light and near-black navy at 60% in dark.

### Shadow Vocabulary
- **Card shadow** (`cardShadow`; offset 0/6dp, blur 18dp, deep blue `#163866` at 9%; Android elevation 2 with a deep-blue shadow colour): under white and deep cards, event cards, endpoint markers, the open Details card and the address suggestion list. Not under pale cards, which sit inside or beside white ones.
- **Floating bar** (the same deep-blue tint, offset 0/8dp, blur 22dp, 14%; Android elevation 8): the navigation bar's stronger setting of the same shadow, because content scrolls behind it.

### Named Rules
**The One Shadow Rule.** There is one shadow: soft, low and tinted with the deep blue. It goes under cards and floating controls in light, and nowhere in dark. No black shadows, no hard or offset shadows, no glows.

**The Tone Before Shadow Rule.** Separate things by tone first: white on ice, pale on white, deep for the one emphasis. Inside a card, separate rows with a hairline divider or space, not with another raised surface.

## Shapes

Corners are soft and generous, with one radius per kind of thing: cards 22dp; blocks inside or between cards 16dp (the open Details card, the map frame, the error card); controls 14dp (the address suggestion list); tags 8dp (line and walk pills, all-day chips); and the full round for pills and discs (time tags, the free-time pill, the navigation bar and its selected pill, endpoint markers, icon discs, today's disc, stop dots, the add button).

react-native-paper's `roundness` is 4, which the kit multiplies per component: buttons and segmented controls at 20dp read as pills, dialogs are 28dp, chips 8dp, and outlined text fields, menus and snackbars 4dp.

Cards have no border; white on ice and the shadow define the edge. Borders appear only as data or as dividers: the 2.5dp blue ring of a stop dot, the 1.5dp dashed ring of an unset endpoint, the 1.5dp dashed outline of a travel block, the 1dp frame of the map, and hairline dividers inside cards.

The trail has four strokes: a plain 2dp rail, a 3dp dotted soft-blue line for walking, a 4dp solid line with 2dp round ends in the line's colour for a vehicle, and a 6 by 2dp tick in the line's colour for each stop a vehicle passes.

Icons are Material Community Icons, outline variants where one exists (`calendar-blank-outline`, `bookmark-outline`, `cog-outline`, `map-marker-outline`, `clock-outline`, `alert-outline`), at 14 to 22dp.

## Components

### Card
The container everything is grouped in. 22dp corners, 18dp padding (or none, with `flush`, when the content manages its own), no border. Three tones:
- **White** (default): the foreground surface, with the card shadow.
- **Pale:** a quieter grouping inside or beside white cards; no shadow.
- **Deep:** the screen's one emphasis card; deep blue with white text, `on-deep-muted` for secondary text, and the card shadow.

### Event card
The anchor of the Day view. A white card, 22dp corners, padding 16 by 18dp, with the card shadow. Title (Title, up to two lines) with the time range at the right in a pale pill tag (Label, tabular, deep-blue ink). Beneath, a location row: a 16dp outline map-pin icon and the place in muted Body. A place that could not be located swaps to the alert pin and says so in words, in the muted red. Tapping the card opens the event's details read-only; a pencil switches the same dialog to editable fields, and a bin deletes after a confirmation.

### Day endpoints
Where the day starts and ends. Not events, so not cards: a 44dp white round marker with the card shadow and a 22dp blue icon, centred on the trail's rail, with the place name in Title, its address in muted Body Small and, at the right, "leave HH:MM" or "arrive HH:MM" with the time in Title Small. Home shows a house; any other place shows the icon that suits it, never a house. With no home set the marker has no fill and a 1.5dp dashed outline, and asks for one. Tapping a marker opens a dialog to type an address or pick a saved place for that day.

### The trail (signature)
The trip between two cards, drawn directly on the ice ground, top to bottom:
- **Free-time offer** (only with 10 minutes or more spare and a place that fits): a pale pill with a clock icon, "31 min free · place" and "+4 min" or "on your way" at the right, in deep-blue ink.
- **Times line:** one muted Body line, "leave 10:58 · 52 min · arrive 11:50", with the two clock times in ink Title Small. The trip from the day's start omits "leave" and the trip to the day's end omits "arrive", because the endpoint markers already carry those times. A warning, if any, sits under it with an alert icon in the muted red.
- **Walking:** a 3dp dotted soft-blue line, with a pale walk pill (a 16dp blue walker) then "Walk" or "Walk via <park>" in muted Body.
- **Vehicle:** a 4dp solid line in the agency's colour, with a line pill, the line's name in ink, minutes and stop count in muted Body Small, "on time" in offer blue or "N min late" in the muted red, and a stairs icon in the muted red with a spoken label when the leg is not step-free.
- **Line pill:** the code printed on the vehicle and signs (bus "144", metro "2", REM "A1") in Bold 14dp tabular on the agency's colour; 24dp tall, at least 32dp wide, 8dp corners.
- **Stop dots:** at every change of mode, a 12dp white dot with a 2.5dp blue ring, the station or stop name in Title Small and its time at the right in muted Title Small. Bus stops add the number printed on their sign.
- **Transfer walks** of 5 minutes or less between two vehicles are not drawn. The first and last walks always are.
- **Passed stops:** tapping a vehicle segment (48dp target, chevron at the right) lists the stops it passes, each with a tick in the line's colour.
- **Details:** a blue text button with a chevron, "Details · N other options". It opens in place as a white card (16dp corners, 16dp padding, card shadow): the reason for this route, estimates (CO2 labelled as an estimate, steps, step-free or has stairs, weather), places that fit the free time under an offer-blue heading, the route map (220dp tall, 16dp corners, 1dp frame) and other routes as divider-separated rows (56dp minimum) that replace the trail when tapped.
- **Same place:** two consecutive events at the same place are joined by a 24dp stretch of the plain rail.

Opening, closing and re-laying the trail eases over 200ms, ease-out, with content fading in; it is instant when the system's remove-animations setting is on. Nothing animates on load.

### Day summary (the deep card on Day)
Three figures in Title Large (time travelling, CO2 saved as an estimate, steps on foot) with muted captions, then a row with a leaf icon, "Green routes", a sentence stating the current state, and a switch.

### Navigation
A floating white pill: 68dp tall, fully rounded, inset 14dp, capped at 520dp, with the floating-bar shadow and no outline; in dark it sits on the fourth elevation step with no shadow. Five destinations (Day, Calendar, Places, Activity, Settings), each a 21dp icon inside a 52 by 30dp pill with a 12dp label beneath. Selected: solid blue pill, white icon, blue SemiBold label. Idle: no pill, muted icon and Medium label.

### Buttons
- **Primary:** blue fill, white label, pill; one per screen or dialog.
- **Tonal** (import, connect): pale fill, deep-blue label, pill.
- **Outlined** and **Text:** secondary and inline actions; text buttons are blue.
- **Add button:** a 56dp round blue button with a white plus, 18dp from the right, just above the navigation bar's clearance (Day and Calendar).
- **Destructive:** a text button in the muted red with a bin icon, behind a confirmation.

### Chips and segmented controls
Material chips (8dp corners) and segmented buttons (pill ends). Unselected is outlined; selected fills pale with deep-blue ink.

### Inputs
Outlined Material text fields on the card's white, 4dp corners, label on the outline, blue outline when focused. The address field lists suggestions beneath it in a white 14dp-cornered list with the card shadow and divider-separated 48dp rows; a located address shows an offer-blue tick and line, a failed one a line in the muted red.

### Calendar
Three views behind a segmented control: Day, Week, Month. The month grid and the hour grid each sit inside one white card.
- **Month:** seven columns, Monday first, a hairline divider between weeks. Day numbers in Title Small; days outside the month muted. Today is a 28dp solid blue disc with a white number. On a phone each event is a 6dp ink dot (three at most, then "+N"); from 600dp wide, up to three lines of "HH:MM title".
- **Week and Day:** an hour grid, 52dp per hour, hour labels in a 44dp gutter, hairline dividers. Hours before 07:00 are left out unless something is planned in them. Events are pale-blue blocks (10dp corners) with deep-blue text, separated from neighbours by a 1dp gap in the card's colour; all-day events are pale chips (8dp corners) in a row above. The current time is a 2dp blue line with an 8dp blue dot. Tapping an empty hour starts a new event there.
- **Day** also draws the commutes as blocks with a 1.5dp dashed soft-blue outline (muted red when the trip does not fit), holding an icon and "HH:MM–HH:MM · lines". Tapping one opens the trail on the Day tab.

### Settings and Saved places
Each section (Settings) or collection (Saved places) is one white card with a Title Large heading. Rows inside are at least 56dp and separated by hairline dividers. Meters are 8dp rounded tracks on pale with a blue fill.

### Activity
The deep card holds today's steps in Display with the goal beside it and a 10dp meter (white fill on a white-18% track). Below, white cards: the step source (segmented control and a status note), the last seven days and two stat rows with 44dp pale icon discs. The chart is a row of bars with 6dp corners: primary blue for days with a green walk, soft blue for the rest, a dashed outline-colour goal line, today's weekday letter in blue, and a sentence beneath that says what darker bars mean.

### Screen frame
Page title in Headline with an optional muted Body Large subtitle beside it; icon-button actions at the right. Errors appear under the title as a card on the muted-red container (16dp corners) with an alert icon, the message and "Retry". Pull-to-refresh, with a blue spinner, where a screen loads data.

## Do's and Don'ts

### Do:
- **Do** build every screen from the same layers: ice ground, white cards (22dp corners, 18dp padding, 14dp apart), pale for selected and quiet states, deep for the one emphasis card.
- **Do** use the `Card` component and the `Radius`, `Space` and `cardShadow` tokens rather than new values.
- **Do** set colour through Material colour roles and `useTokens`, so react-native-paper components and both themes pick it up.
- **Do** show every vehicle line as a pill with its code on the agency's colour, and draw its stretch of the route in that colour.
- **Do** pair every muted-red warning with an icon or words, and label estimates and sample data as such.
- **Do** choose a Figtree weight by choosing the type variant or `Font` family, and use tabular numerals for times, durations and counts.
- **Do** distinguish chart series by shade of blue (primary for the highlighted series, soft for the rest) and say in words what the darker shade means.
- **Do** keep reasons, estimates, places, the map and other options behind "Details", opened in place.
- **Do** keep every tap target at least 48dp tall, and keep 96dp plus the bottom system inset clear at the bottom of every screen for the floating navigation bar.
- **Do** ease layout changes over 200ms ease-out and respect the remove-animations setting.

### Don't:
- **Don't** add a second accent hue, a gradient or decorative colour; blue is the only accent.
- **Don't** use an agency's line colour anywhere except that line's pill and its stretch of the route, and don't recolour a line with a theme colour.
- **Don't** use the muted red for anything but warnings, errors and destructive actions, or on its own without an icon or words.
- **Don't** put more than one deep-blue card on a screen.
- **Don't** set `fontWeight` or letter spacing on text.
- **Don't** add a shadow other than the card shadow, tint one with black, or use any shadow in the dark theme.
- **Don't** draw a border around a card; use tone and the shadow.
- **Don't** write step-by-step instruction sentences on the trail, or draw transfer walks of 5 minutes or less between two vehicles.
- **Don't** animate anything on load.
- **Don't** show a product name; none exists.
