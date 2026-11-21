package calendar_test

import (
	"testing"
	"time"

	"github.com/nim-sam/codejam16/backend/internal/adapter/calendar"
)

func TestParseICS(t *testing.T) {
	sampleICS := `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Hackathon//Codejam16//EN
BEGIN:VEVENT
UID:hack-event-001
SUMMARY:Codejam Opening Ceremony
DESCRIPTION:Kickoff at McGill New Chancellor Day Hall
LOCATION:McGill Faculty of Law, Montreal
DTSTART:20261120T140000Z
DTEND:20261120T153000Z
END:VEVENT
END:VCALENDAR`

	events, err := calendar.ParseICS(sampleICS)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if len(events) != 1 {
		t.Fatalf("Expected 1 event, got %d", len(events))
	}

	e := events[0]
	if e.Title != "Codejam Opening Ceremony" {
		t.Errorf("Expected title 'Codejam Opening Ceremony', got '%s'", e.Title)
	}

	expectedStart := time.Date(2026, 11, 20, 14, 0, 0, 0, time.UTC)
	if !e.StartTime.Equal(expectedStart) {
		t.Errorf("Expected start %v, got %v", expectedStart, e.StartTime)
	}
}

func TestParseICSUnfoldsAndUnescapes(t *testing.T) {
	ics := "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:x1\r\nSUMMARY:Lab\r\n" +
		"LOCATION:3480 Rue University\\, Montr\r\n éal\\, QC\r\n" +
		"DTSTART;TZID=America/Toronto:20261123T090000\r\nDTEND;TZID=America/Toronto:20261123T100000\r\n" +
		"END:VEVENT\r\nEND:VCALENDAR\r\n"
	events, err := calendar.ParseICS(ics)
	if err != nil || len(events) != 1 {
		t.Fatalf("got %d events, err %v", len(events), err)
	}
	e := events[0]
	if e.Location.Name != "3480 Rue University, Montréal, QC" {
		t.Errorf("location = %q", e.Location.Name)
	}
	if e.Location.Latitude != 0 {
		t.Error("parser must not invent coordinates")
	}
	if e.StartTime.Hour() != 9 {
		t.Errorf("start hour = %d, want 9 local", e.StartTime.Hour())
	}
}

func TestParseICSExpandsWeeklyRecurrence(t *testing.T) {
	// A Mon/Wed class starting last Monday, 6 occurrences in total.
	now := time.Now()
	monday := now.AddDate(0, 0, -((int(now.Weekday())+6)%7)-7)
	start := time.Date(monday.Year(), monday.Month(), monday.Day(), 10, 0, 0, 0, time.Local)
	ics := "BEGIN:VEVENT\nUID:class\nSUMMARY:COMP 512\nLOCATION:McConnell\n" +
		"DTSTART:" + start.Format("20060102T150405") + "\nDTEND:" + start.Add(90*time.Minute).Format("20060102T150405") + "\n" +
		"RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=6\nEND:VEVENT\n"
	events, err := calendar.ParseICS(ics)
	if err != nil {
		t.Fatal(err)
	}
	if len(events) != 6 {
		t.Fatalf("got %d occurrences, want 6", len(events))
	}
	ids := map[string]bool{}
	for i, e := range events {
		if wd := e.StartTime.Weekday(); wd != time.Monday && wd != time.Wednesday {
			t.Errorf("occurrence %d falls on %v", i, wd)
		}
		if e.EndTime.Sub(e.StartTime) != 90*time.Minute || e.StartTime.Hour() != 10 {
			t.Errorf("occurrence %d has wrong time: %v-%v", i, e.StartTime, e.EndTime)
		}
		ids[e.ID] = true
	}
	if len(ids) != 6 {
		t.Error("occurrences must have distinct ids")
	}
	if !events[5].StartTime.Equal(start.AddDate(0, 0, 16)) { // Mon, Wed, Mon, Wed, Mon, Wed
		t.Errorf("last occurrence = %v", events[5].StartTime)
	}
}
