package calendar

import (
	"bufio"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/nim-sam/tandem/backend/internal/domain"
)

// ParseICS parses raw .ics (iCalendar) text into domain Events.
func ParseICS(icsContent string) ([]domain.Event, error) {
	// RFC 5545: long lines are folded; a continuation starts with a space or tab.
	icsContent = strings.ReplaceAll(icsContent, "\r\n", "\n")
	icsContent = strings.ReplaceAll(icsContent, "\n ", "")
	icsContent = strings.ReplaceAll(icsContent, "\n\t", "")
	scanner := bufio.NewScanner(strings.NewReader(icsContent))
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	var events []domain.Event
	var currentEvent *domain.Event
	inEvent := false
	rrule := ""
	now := time.Now()

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "BEGIN:VEVENT" {
			inEvent = true
			currentEvent = &domain.Event{
				IsExternal:     true,
				ExternalSource: "ics",
				CreatedAt:      time.Now(),
				UpdatedAt:      time.Now(),
			}
			continue
		}

		if line == "END:VEVENT" && inEvent && currentEvent != nil {
			if currentEvent.ID == "" {
				currentEvent.ID = fmt.Sprintf("ics-%d", time.Now().UnixNano())
			}
			if currentEvent.Title == "" {
				currentEvent.Title = "Untitled Event"
			}
			// Coordinates are left at zero here; CalendarService geocodes the
			// LOCATION text. Events that cannot be located are not routed.
			if rrule != "" {
				events = append(events, expandRecurring(*currentEvent, rrule, now.AddDate(0, 0, -30), now.AddDate(0, 0, 120))...)
			} else {
				events = append(events, *currentEvent)
			}
			rrule = ""
			currentEvent = nil
			inEvent = false
			continue
		}

		if !inEvent || currentEvent == nil {
			continue
		}

		parts := strings.SplitN(line, ":", 2)
		if len(parts) < 2 {
			continue
		}
		key := strings.ToUpper(parts[0])
		val := unescapeICSText(parts[1])

		// Handle parameters like DTSTART;TZID=...
		if idx := strings.Index(key, ";"); idx != -1 {
			key = key[:idx]
		}

		switch key {
		case "UID":
			currentEvent.ExternalID = val
			currentEvent.ID = "ics-" + val
		case "SUMMARY":
			currentEvent.Title = val
		case "DESCRIPTION":
			currentEvent.Description = val
		case "LOCATION":
			currentEvent.Location = domain.Location{
				Name:    val,
				Address: val,
			}
		case "RRULE":
			rrule = parts[1]
		case "DTSTART":
			if t, err := parseICSTime(val); err == nil {
				currentEvent.StartTime = t
			}
		case "DTEND":
			if t, err := parseICSTime(val); err == nil {
				currentEvent.EndTime = t
			}
		}
	}

	return events, scanner.Err()
}

func parseICSTime(val string) (time.Time, error) {
	// Format 1: 20261120T150405Z (UTC)
	if strings.HasSuffix(val, "Z") {
		return time.Parse("20060102T150405Z", val)
	}
	// Format 2: 20261120T150405
	if strings.Contains(val, "T") {
		// Floating or TZID time: treat as server-local (TZ=America/Toronto).
		return time.ParseInLocation("20060102T150405", val, time.Local)
	}
	// Format 3: 20261120 (All day date)
	return time.ParseInLocation("20060102", val, time.Local)
}

func unescapeICSText(val string) string {
	return strings.NewReplacer(`\,`, ",", `\;`, ";", `\n`, " ", `\N`, " ", `\\`, `\`).Replace(val)
}

// expandRecurring turns a recurring event into its individual occurrences
// inside [from, to]. Supports FREQ=DAILY/WEEKLY/MONTHLY/YEARLY with INTERVAL,
// COUNT, UNTIL and (for WEEKLY) BYDAY. EXDATE and the rarer BY* parts are not
// handled; such events may show extra occurrences.
func expandRecurring(e domain.Event, rule string, from, to time.Time) []domain.Event {
	params := map[string]string{}
	for _, kv := range strings.Split(rule, ";") {
		if k, v, ok := strings.Cut(kv, "="); ok {
			params[strings.ToUpper(k)] = strings.ToUpper(v)
		}
	}
	interval := 1
	if n, err := strconv.Atoi(params["INTERVAL"]); err == nil && n > 0 {
		interval = n
	}
	count := -1
	if n, err := strconv.Atoi(params["COUNT"]); err == nil && n > 0 {
		count = n
	}
	until := to
	if u, err := parseICSTime(params["UNTIL"]); err == nil && params["UNTIL"] != "" {
		if len(params["UNTIL"]) == 8 { // date only: include the whole day
			u = u.Add(24*time.Hour - time.Second)
		}
		if u.Before(until) {
			until = u
		}
	}
	weekdays := map[time.Weekday]bool{}
	names := map[string]time.Weekday{"SU": 0, "MO": 1, "TU": 2, "WE": 3, "TH": 4, "FR": 5, "SA": 6}
	for _, d := range strings.Split(params["BYDAY"], ",") {
		if wd, ok := names[strings.TrimLeft(d, "+-0123456789")]; ok {
			weekdays[wd] = true
		}
	}

	duration := e.EndTime.Sub(e.StartTime)
	baseID := e.ID
	var out []domain.Event
	emit := func(start time.Time) {
		if start.Before(from) {
			return
		}
		occ := e
		occ.ID = baseID + "-" + start.Format("20060102")
		occ.StartTime, occ.EndTime = start, start.Add(duration)
		out = append(out, occ)
	}

	start := e.StartTime
	made := 0
	done := func(t time.Time) bool { return t.After(until) || (count >= 0 && made >= count) || len(out) >= 500 }
	switch params["FREQ"] {
	case "DAILY":
		for t := start; !done(t); t = t.AddDate(0, 0, interval) {
			emit(t)
			made++
		}
	case "WEEKLY":
		if len(weekdays) == 0 {
			weekdays[start.Weekday()] = true
		}
		// Monday of the first week, to count whole weeks for INTERVAL.
		weekStart := start.AddDate(0, 0, -((int(start.Weekday()) + 6) % 7))
		for t := start; !done(t); t = t.AddDate(0, 0, 1) {
			weeks := int(t.Sub(weekStart).Hours()/24) / 7
			if weekdays[t.Weekday()] && weeks%interval == 0 {
				emit(t)
				made++
			}
		}
	case "MONTHLY":
		for i := 0; ; i++ {
			t := start.AddDate(0, i*interval, 0)
			if done(t) {
				break
			}
			if t.Day() == start.Day() { // skip months without that day (e.g. the 31st)
				emit(t)
				made++
			}
		}
	case "YEARLY":
		for i := 0; ; i++ {
			t := start.AddDate(i*interval, 0, 0)
			if done(t) {
				break
			}
			emit(t)
			made++
		}
	default:
		return []domain.Event{e}
	}
	return out
}
