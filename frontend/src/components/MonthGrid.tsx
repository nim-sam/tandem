import React, { useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Text, TouchableRipple } from 'react-native-paper';
import { Event } from '../types';
import { useTokens } from '../theme';
import { addDays, addMonths, formatTime, fromDateKey, mondayOf, startOfMonth, toDateKey, todayKey } from '../utils/format';

interface Props {
  month: string; // any day of the month shown
  events: Event[];
  onPressDay: (day: string) => void;
}

// The first Monday on or before the 1st, and enough whole weeks to cover the month.
export const monthRange = (month: string): { from: string; weeks: number } => {
  const first = startOfMonth(month);
  const from = mondayOf(first);
  const lastDay = addDays(addMonths(first, 1), -1);
  const days = Math.round((fromDateKey(lastDay).getTime() - fromDateKey(from).getTime()) / 86400000) + 1;
  return { from, weeks: Math.ceil(days / 7) };
};

// A month at a glance. On a wide window each day lists its first events; on a
// phone it shows a dot per event. Tapping a day opens it.
export const MonthGrid: React.FC<Props> = ({ month, events, onPressDay }) => {
  const tokens = useTokens();
  const { width } = useWindowDimensions();
  const wide = width >= 600;
  const today = todayKey();
  const { from, weeks } = monthRange(month);
  const inMonth = startOfMonth(month).slice(0, 7);

  const byDay = useMemo(() => {
    const map = new Map<string, Event[]>();
    for (const e of events) {
      const key = toDateKey(new Date(e.start_time));
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return map;
  }, [events]);

  const maxLines = 3;

  return (
    <View>
      <View style={styles.week}>
        {Array.from({ length: 7 }, (_, i) => (
          <Text key={i} variant="labelSmall" style={[styles.weekday, { color: tokens.muted }]}>
            {fromDateKey(addDays(from, i)).toLocaleDateString([], { weekday: 'short' })}
          </Text>
        ))}
      </View>
      {Array.from({ length: weeks }, (_, w) => (
        <View key={w} style={styles.week}>
          {Array.from({ length: 7 }, (_, i) => {
            const day = addDays(from, w * 7 + i);
            const date = fromDateKey(day);
            const dayEvents = byDay.get(day) ?? [];
            const outside = day.slice(0, 7) !== inMonth;
            const isToday = day === today;
            return (
              <TouchableRipple
                key={day}
                onPress={() => onPressDay(day)}
                accessibilityRole="button"
                accessibilityLabel={`${date.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}, ${
                  dayEvents.length === 0 ? 'no events' : `${dayEvents.length} event${dayEvents.length > 1 ? 's' : ''}`
                }. Open the day with its routes.`}
                style={[styles.cell, { borderTopColor: tokens.hairline, minHeight: wide ? 104 : 64 }]}
              >
                <View style={wide ? styles.cellWide : styles.cellNarrow}>
                  <View style={[styles.number, isToday && { backgroundColor: tokens.gold }]}>
                    <Text
                      variant="titleSmall"
                      style={[styles.tabular, { color: isToday ? tokens.onGold : outside ? tokens.muted : tokens.post }, outside && !isToday && { opacity: 0.6 }]}
                    >
                      {date.getDate()}
                    </Text>
                  </View>
                  {wide ? (
                    <View style={styles.lines}>
                      {dayEvents.slice(0, maxLines).map((e) => (
                        <Text key={e.id} variant="bodySmall" numberOfLines={1} style={outside && { opacity: 0.6 }}>
                          <Text variant="bodySmall" style={[styles.tabular, { color: tokens.muted }]}>
                            {formatTime(e.start_time)}{' '}
                          </Text>
                          {e.title}
                        </Text>
                      ))}
                      {dayEvents.length > maxLines && (
                        <Text variant="bodySmall" style={{ color: tokens.muted }}>
                          +{dayEvents.length - maxLines} more
                        </Text>
                      )}
                    </View>
                  ) : (
                    dayEvents.length > 0 && (
                      <View style={styles.dots}>
                        {dayEvents.slice(0, 3).map((e) => (
                          <View key={e.id} style={[styles.dot, { backgroundColor: outside ? tokens.muted : tokens.post }]} />
                        ))}
                        {dayEvents.length > 3 && (
                          <Text variant="labelSmall" style={{ color: tokens.muted, lineHeight: 12 }}>
                            +{dayEvents.length - 3}
                          </Text>
                        )}
                      </View>
                    )
                  )}
                </View>
              </TouchableRipple>
            );
          })}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', paddingVertical: 6 },
  cell: { flex: 1, borderTopWidth: StyleSheet.hairlineWidth },
  cellWide: { padding: 6, gap: 4 },
  cellNarrow: { alignItems: 'center', paddingVertical: 6, gap: 6 },
  number: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  lines: { gap: 2 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  tabular: { fontVariant: ['tabular-nums'] },
});
