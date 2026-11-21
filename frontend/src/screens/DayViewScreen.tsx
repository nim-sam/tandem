import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Chip, FAB, Icon, IconButton, Text, TouchableRipple } from 'react-native-paper';
import { useApp } from '../store/AppContext';
import { Screen } from '../components/Screen';
import { CommuteCard } from '../components/CommuteCard';
import { EventDialog } from '../components/EventDialog';
import { useLeaveNotifications } from '../hooks/useLeaveNotifications';
import { useAppTheme, useTokens } from '../theme';
import { Event, Route } from '../types';
import { addDays, formatCO2, formatDay, formatDuration, formatTime, fromDateKey, todayKey } from '../utils/format';

// An event is a bordered block; the line to the next event leaves from under it.
const EventBlock: React.FC<{ event: Event; onPress: () => void }> = ({ event, onPress }) => {
  const theme = useAppTheme();
  const tokens = useTokens();
  const located = !!(event.location.latitude || event.location.longitude);
  return (
    <TouchableRipple
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Edit ${event.title}`}
      style={[styles.event, { borderColor: theme.colors.onSurface }]}
    >
      <View>
        <View style={styles.eventHead}>
          <Text variant="titleMedium" style={{ flex: 1 }} numberOfLines={2}>
            {event.title}
          </Text>
          <Text variant="titleSmall" style={styles.tabular}>
            {formatTime(event.start_time)}–{formatTime(event.end_time)}
          </Text>
        </View>
        <Text variant="bodyMedium" style={{ color: located ? tokens.muted : tokens.warn }} numberOfLines={2}>
          {event.location.name
            ? located
              ? event.location.name
              : `${event.location.name}: not found on the map, so no route is planned`
            : 'No location'}
        </Text>
      </View>
    </TouchableRipple>
  );
};

export const DayViewScreen: React.FC = () => {
  const theme = useAppTheme();
  const tokens = useTokens();
  const { date, setDate, schedule, loading, error, refresh, selectRoute, preferences, updatePreferences } = useApp();
  const [editing, setEditing] = useState<Event | null>(null);
  const [dialog, setDialog] = useState(false);
  const [selectError, setSelectError] = useState<string | null>(null);

  // Reminders are only scheduled for the real "today".
  useLeaveNotifications(date === todayKey() ? schedule : null, true);

  const commuteFrom = (originId: string): Route | undefined =>
    schedule?.commutes.find((c) => c.origin_event_id === originId);

  const choose = (routeId: string) => {
    setSelectError(null);
    selectRoute(routeId).catch((e) => setSelectError(e instanceof Error ? e.message : String(e)));
  };

  const renderCommute = (route: Route | undefined) => route && <CommuteCard route={route} onSelect={choose} />;

  const nature = preferences?.prefer_nature_routes ?? false;
  const showing = schedule && schedule.date === date ? schedule : null;
  const home = commuteFrom('home');

  return (
    <View style={styles.root}>
      <Screen
        title={formatDay(date)}
        subtitle={fromDateKey(date).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}
        error={error ?? selectError}
        onRetry={refresh}
        refreshing={loading && !!showing}
        onRefresh={refresh}
        flush
        actions={
          <>
            <IconButton icon="chevron-left" accessibilityLabel="Previous day" onPress={() => setDate(addDays(date, -1))} />
            {date !== todayKey() && (
              <IconButton icon="calendar-today" accessibilityLabel="Go to today" onPress={() => setDate(todayKey())} />
            )}
            <IconButton icon="chevron-right" accessibilityLabel="Next day" onPress={() => setDate(addDays(date, 1))} />
          </>
        }
      >
        {!showing ? (
          loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={tokens.gold} />
              <Text variant="bodyMedium" style={{ color: tokens.muted }}>
                Planning your routes…
              </Text>
            </View>
          ) : null
        ) : (
          <>
            <View style={styles.summary}>
              <Chip
                icon="pine-tree"
                selected={nature}
                showSelectedCheck={false}
                mode={nature ? 'flat' : 'outlined'}
                onPress={() => preferences && updatePreferences({ ...preferences, prefer_nature_routes: !nature })}
                accessibilityLabel={`Prefer green routes: ${nature ? 'on' : 'off'}`}
                hitSlop={{ top: 8, bottom: 8 }}
              >
                Green routes {nature ? 'on' : 'off'}
              </Chip>
              {showing.commutes.length > 0 && (
                <Text variant="bodySmall" style={[styles.totals, { color: tokens.muted }]}>
                  {formatDuration(showing.summary.total_commute_minutes)} travelling{'\n'}
                  about {formatCO2(showing.summary.total_co2_saved_grams)} CO₂ saved
                </Text>
              )}
            </View>

            {showing.events.length === 0 ? (
              <View style={styles.center}>
                <Icon source="calendar-blank-outline" size={48} color={tokens.muted} />
                <Text variant="titleMedium">Nothing planned</Text>
                <Text variant="bodyMedium" style={{ color: tokens.muted, textAlign: 'center' }}>
                  Add an event with the + button, or import a calendar from the Calendar tab.
                </Text>
              </View>
            ) : (
              <View style={styles.day}>
                {home && (
                  <View style={[styles.event, { borderColor: theme.colors.onSurface }]}>
                    <Text variant="titleMedium">Home</Text>
                    <Text variant="bodyMedium" style={{ color: tokens.muted }} numberOfLines={1}>
                      {home.origin_location.address || home.origin_location.name}
                    </Text>
                  </View>
                )}
                {renderCommute(home)}
                {showing.events.map((event) => (
                  <View key={event.id}>
                    <EventBlock
                      event={event}
                      onPress={() => {
                        setEditing(event);
                        setDialog(true);
                      }}
                    />
                    {renderCommute(commuteFrom(event.id))}
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </Screen>

      <FAB
        icon="plus"
        accessibilityLabel="Add event"
        style={[styles.fab, { backgroundColor: tokens.gold }]}
        color={tokens.onGold}
        onPress={() => {
          setEditing(null);
          setDialog(true);
        }}
      />
      <EventDialog visible={dialog} date={date} event={editing} onDismiss={() => setDialog(false)} onSaved={refresh} />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20 },
  totals: { flex: 1, textAlign: 'right', fontVariant: ['tabular-nums'] },
  day: { paddingHorizontal: 20 },
  event: { borderWidth: 2, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, minHeight: 48 },
  eventHead: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  tabular: { fontVariant: ['tabular-nums'] },
  center: { alignItems: 'center', gap: 8, paddingVertical: 56, paddingHorizontal: 32 },
  fab: { position: 'absolute', right: 16, bottom: 16 },
});
