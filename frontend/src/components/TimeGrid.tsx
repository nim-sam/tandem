import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, TouchableRipple } from 'react-native-paper';
import { Event } from '../types';
import { useTokens } from '../theme';
import { formatTime, fromDateKey, toDateKey, todayKey } from '../utils/format';

const HOUR = 52; // height of one hour
const GUTTER = 44; // width of the hour labels
const EARLIEST_SHOWN = 7; // the grid opens at 07:00 unless something is planned before

interface Props {
  days: string[]; // one column per day
  events: Event[];
  onPressEvent: (event: Event) => void;
  onPressSlot: (day: string, hour: number) => void; // an empty hour: add an event there
  onPressDay?: (day: string) => void; // a day heading
}

interface Placed {
  event: Event;
  top: number;
  height: number;
  col: number;
  cols: number;
}

const minutesInto = (iso: string, day: string): number => {
  const diff = (new Date(iso).getTime() - fromDateKey(day).getTime()) / 60000;
  return Math.max(0, Math.min(24 * 60, diff));
};

const isAllDay = (e: Event): boolean =>
  new Date(e.end_time).getTime() - new Date(e.start_time).getTime() >= 23 * 3600 * 1000;

// Events that overlap share the column's width side by side.
const place = (events: Event[], day: string): Placed[] => {
  const sorted = [...events].sort((a, b) => a.start_time.localeCompare(b.start_time));
  const placed: (Placed & { end: number })[] = [];
  let cluster: (Placed & { end: number })[] = [];
  let clusterEnd = 0;
  const close = () => {
    const cols = Math.max(1, ...cluster.map((p) => p.col + 1));
    cluster.forEach((p) => (p.cols = cols));
    cluster = [];
  };
  for (const event of sorted) {
    const start = minutesInto(event.start_time, day);
    const end = Math.max(start + 25, minutesInto(event.end_time, day)); // short events still get a readable block
    if (cluster.length && start >= clusterEnd) close();
    let col = 0;
    while (cluster.some((p) => p.col === col && p.end > start)) col++;
    const item = { event, top: start, height: end - start, col, cols: 1, end }; // in minutes; scaled when drawn
    cluster.push(item);
    placed.push(item);
    clusterEnd = Math.max(clusterEnd, end);
  }
  close();
  return placed;
};

// A calendar's hour grid: one column per day, events as blocks at their time.
export const TimeGrid: React.FC<Props> = ({ days, events, onPressEvent, onPressSlot, onPressDay }) => {
  const tokens = useTokens();
  const today = todayKey();
  const week = days.length > 1;

  const byDay = useMemo(() => {
    const map = new Map<string, { timed: Placed[]; allDay: Event[] }>();
    for (const day of days) {
      const mine = events.filter((e) => toDateKey(new Date(e.start_time)) === day);
      map.set(day, { timed: place(mine.filter((e) => !isAllDay(e)), day), allDay: mine.filter(isAllDay) });
    }
    return map;
  }, [days, events]);
  const anyAllDay = days.some((d) => byDay.get(d)?.allDay.length);

  // Empty early hours are left out so the first thing planned is on screen.
  const firstHour = useMemo(() => {
    const starts = days.flatMap((d) => byDay.get(d)?.timed.map((p) => p.top) ?? []);
    return Math.max(0, Math.min(EARLIEST_SHOWN, ...starts.map((m) => Math.floor(m / 60))));
  }, [days, byDay]);
  const hours = Array.from({ length: 24 - firstHour }, (_, i) => firstHour + i);
  const y = (minutes: number) => ((minutes - firstHour * 60) / 60) * HOUR;

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  return (
    <View>
      {week && (
        <View style={[styles.header, { borderBottomColor: tokens.hairline }]}>
          <View style={{ width: GUTTER }} />
          {days.map((day) => {
            const d = fromDateKey(day);
            const isToday = day === today;
            return (
              <Pressable
                key={day}
                style={styles.dayHead}
                onPress={() => onPressDay?.(day)}
                accessibilityRole="button"
                accessibilityLabel={`Open ${d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })} with its routes`}
              >
                <Text variant="labelSmall" style={{ color: tokens.muted }}>
                  {d.toLocaleDateString([], { weekday: 'short' })}
                </Text>
                <View style={[styles.dayNumber, isToday && { backgroundColor: tokens.accent }]}>
                  <Text variant="titleSmall" style={[styles.tabular, isToday && { color: tokens.onAccent }]}>
                    {d.getDate()}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {anyAllDay && (
        <View style={[styles.allDay, { borderBottomColor: tokens.hairline }]}>
          <View style={styles.allDayLabel}>
            <Text variant="labelSmall" style={{ color: tokens.muted }}>
              all day
            </Text>
          </View>
          {days.map((day) => (
            <View key={day} style={styles.allDayColumn}>
              {byDay.get(day)?.allDay.map((event) => (
                <TouchableRipple
                  key={event.id}
                  onPress={() => onPressEvent(event)}
                  accessibilityRole="button"
                  accessibilityLabel={`${event.title}, all day. Show details.`}
                  style={[styles.allDayChip, { backgroundColor: tokens.pale }]}
                >
                  <Text variant="labelSmall" numberOfLines={1} style={{ color: tokens.onPale }}>
                    {event.title}
                  </Text>
                </TouchableRipple>
              ))}
            </View>
          ))}
        </View>
      )}

      <View style={[styles.grid, { height: hours.length * HOUR }]}>
        <View style={{ width: GUTTER }}>
          {hours.map((h) => (
            <Text key={h} variant="labelSmall" style={[styles.hour, styles.tabular, { top: y(h * 60) - 8, color: tokens.muted }]}>
              {`${String(h).padStart(2, '0')}:00`}
            </Text>
          ))}
        </View>

        {days.map((day) => (
          <View key={day} style={[styles.column, { borderLeftColor: tokens.hairline }]}>
            {hours.map((h) => (
              <Pressable
                key={h}
                onPress={() => onPressSlot(day, h)}
                style={[styles.slot, { borderTopColor: tokens.hairline }]}
                accessibilityRole="button"
                accessibilityLabel={`Add an event on ${fromDateKey(day).toLocaleDateString([], {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })} at ${h}:00`}
              />
            ))}

            {byDay.get(day)?.timed.map(({ event, top: startMin, height: minutes, col, cols }) => {
              const top = y(startMin);
              const height = (minutes / 60) * HOUR;
              return (
              <TouchableRipple
                key={event.id}
                onPress={() => onPressEvent(event)}
                accessibilityRole="button"
                accessibilityLabel={`${event.title}, ${formatTime(event.start_time)} to ${formatTime(event.end_time)}. Show details.`}
                style={[
                  styles.event,
                  {
                    top: top + 1,
                    height: height - 2,
                    left: `${(col / cols) * 100}%`,
                    width: `${100 / cols}%`,
                    backgroundColor: tokens.pale,
                    borderColor: tokens.card, // a gap between neighbours, not an outline
                  },
                ]}
              >
                <View style={week ? styles.eventInnerWeek : styles.eventInner}>
                  <Text variant={week ? 'labelSmall' : 'titleSmall'} numberOfLines={week || height < 40 ? 1 : 2} style={{ color: tokens.onPale }}>
                    {event.title}
                  </Text>
                  {!week && height >= 44 && (
                    <Text variant="bodySmall" numberOfLines={1} style={[styles.tabular, { color: tokens.muted }]}>
                      {formatTime(event.start_time)}–{formatTime(event.end_time)}
                      {event.location.name ? ` · ${event.location.name}` : ''}
                    </Text>
                  )}
                </View>
              </TouchableRipple>
              );
            })}

            {day === today && nowMinutes >= firstHour * 60 && (
              <View pointerEvents="none" style={[styles.now, { top: y(nowMinutes), backgroundColor: tokens.accent }]}>
                <View style={[styles.nowDot, { backgroundColor: tokens.accent }]} />
              </View>
            )}
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 4 },
  dayHead: { flex: 1, alignItems: 'center', minHeight: 48, justifyContent: 'center', gap: 2 },
  dayNumber: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  allDay: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 4 },
  allDayLabel: { width: GUTTER, justifyContent: 'center' },
  allDayColumn: { flex: 1, gap: 2, paddingHorizontal: 1 },
  allDayChip: { borderRadius: 8, paddingHorizontal: 6, minHeight: 24, justifyContent: 'center' },
  grid: { flexDirection: 'row', marginTop: 8 },
  hour: { position: 'absolute', left: 0 },
  column: { flex: 1, borderLeftWidth: StyleSheet.hairlineWidth },
  slot: { height: HOUR, borderTopWidth: StyleSheet.hairlineWidth },
  event: { position: 'absolute', borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  eventInner: { paddingHorizontal: 8, paddingVertical: 2 },
  eventInnerWeek: { paddingHorizontal: 3, paddingVertical: 2 },
  now: { position: 'absolute', left: 0, right: 0, height: 2 },
  nowDot: { position: 'absolute', left: -4, top: -3, width: 8, height: 8, borderRadius: 4 },
  tabular: { fontVariant: ['tabular-nums'] },
});
