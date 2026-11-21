import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, FAB, Icon, IconButton, Switch, Text, TouchableRipple } from 'react-native-paper';
import { useApp } from '../store/AppContext';
import { Screen } from '../components/Screen';
import { CommuteCard } from '../components/CommuteCard';
import { EventDialog } from '../components/EventDialog';
import { EndpointDialog } from '../components/EndpointDialog';
import { useLeaveNotifications } from '../hooks/useLeaveNotifications';
import { Blue, NAV_CLEARANCE, Radius, Space, cardShadow, endpointIcon, useAppTheme, useTokens } from '../theme';
import { Card } from '../components/Card';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DAY_END, DAY_START, DayEndpoint, EndpointKind, Event, Route } from '../types';
import { addDays, isNearDay, formatCO2, formatDay, formatDuration, formatTime, fromDateKey, todayKey } from '../utils/format';

// An event is a white card; the line to the next event leaves from under it.
// Tapping it opens the event's details.
const EventBlock: React.FC<{ event: Event; onPress: () => void }> = ({ event, onPress }) => {
  const theme = useAppTheme();
  const tokens = useTokens();
  const located = !!(event.location.latitude || event.location.longitude);
  return (
    <View style={[styles.event, { backgroundColor: tokens.card }, cardShadow(theme.dark)]}>
      <TouchableRipple
        onPress={onPress}
        borderless
        accessibilityRole="button"
        accessibilityLabel={`${event.title}, ${formatTime(event.start_time)} to ${formatTime(event.end_time)}. Show details.`}
        style={styles.eventTouch}
      >
        <View style={styles.eventBody}>
          <View style={styles.eventHead}>
            <Text variant="titleMedium" style={{ flex: 1 }} numberOfLines={2}>
              {event.title}
            </Text>
            <View style={[styles.timeTag, { backgroundColor: tokens.pale }]}>
              <Text variant="labelMedium" style={[styles.tabular, { color: tokens.onPale }]}>
                {formatTime(event.start_time)}–{formatTime(event.end_time)}
              </Text>
            </View>
          </View>
          <View style={styles.eventPlace}>
            <Icon source={located ? 'map-marker-outline' : 'map-marker-alert-outline'} size={16} color={located ? tokens.muted : tokens.warn} />
            <Text variant="bodyMedium" style={{ flex: 1, color: located ? tokens.muted : tokens.warn }} numberOfLines={2}>
              {event.location.name
                ? located
                  ? event.location.name
                  : `${event.location.name}: not found on the map, so no route is planned`
                : 'No location'}
            </Text>
          </View>
        </View>
      </TouchableRipple>
    </View>
  );
};

// Two events held at the same place (the server plans no commute between
// points closer than about 100 m).
const samePlace = (a: Event, b?: Event): boolean => {
  if (!b) return false;
  const la = a.location;
  const lb = b.location;
  if ((la.latitude || la.longitude) && (lb.latitude || lb.longitude)) {
    return Math.abs(la.latitude - lb.latitude) <= 0.001 && Math.abs(la.longitude - lb.longitude) <= 0.001;
  }
  return !!la.name && la.name.trim().toLowerCase() === lb.name.trim().toLowerCase();
};

// Where the day starts or ends. It is a place, not an event, so it is drawn as
// a round marker on the trail (a house for home, otherwise the icon that suits
// the place) rather than a block. The time beside it comes from the commute:
// when to leave the start, when the trip back arrives. Tapping it changes the place.
const EndpointMarker: React.FC<{
  which: EndpointKind;
  endpoint: DayEndpoint | null;
  time?: string;
  onPress: () => void;
}> = ({ which, endpoint, time, onPress }) => {
  const theme = useAppTheme();
  const tokens = useTokens();
  const starts = which === 'origin';
  const name = endpoint ? (endpoint.is_home ? 'Home' : endpoint.location.name) : 'Set your home';
  const detail = endpoint
    ? endpoint.location.address && endpoint.location.address !== name
      ? endpoint.location.address
      : ''
    : starts
      ? 'to plan the trip to your first event'
      : 'to plan the trip back from your last event';
  const icon = endpoint ? endpointIcon(endpoint) : 'home-plus-outline';
  return (
    <TouchableRipple
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        endpoint
          ? `The day ${starts ? 'starts from' : 'ends at'} ${name}${
              time ? `, ${starts ? 'leave at' : 'arrive at'} ${time}` : ''
            }. Change where the day ${starts ? 'starts' : 'ends'}.`
          : `Set your home ${detail}`
      }
    >
      <View style={styles.endpoint}>
        <View
          style={[
            styles.marker,
            endpoint
              ? [{ backgroundColor: tokens.card }, cardShadow(theme.dark)]
              : { borderWidth: 1.5, borderStyle: 'dashed', borderColor: tokens.border },
          ]}
        >
          <Icon source={icon} size={22} color={endpoint ? tokens.accent : tokens.muted} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="titleMedium" numberOfLines={1} style={{ color: endpoint ? tokens.post : tokens.muted }}>
            {name}
          </Text>
          {!!detail && (
            <Text variant="bodySmall" style={{ color: tokens.muted }} numberOfLines={1}>
              {detail}
            </Text>
          )}
        </View>
        {!!time && (
          <Text variant="bodyMedium" style={[styles.tabular, { color: tokens.muted }]}>
            {starts ? 'leave' : 'arrive'}{' '}
            <Text variant="titleSmall" style={{ color: tokens.post }}>
              {time}
            </Text>
          </Text>
        )}
      </View>
    </TouchableRipple>
  );
};

export const DayViewScreen: React.FC = () => {
  const tokens = useTokens();
  const insets = useSafeAreaInsets();
  const { date, setDate, schedule, loading, error, refresh, selectRoute, preferences, updatePreferences } = useApp();
  const [editing, setEditing] = useState<Event | null>(null);
  const [dialog, setDialog] = useState(false);
  const [selectError, setSelectError] = useState<string | null>(null);
  const [endpointDialog, setEndpointDialog] = useState<EndpointKind | null>(null);

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
  const fromStart = commuteFrom(DAY_START);
  const toEnd = showing?.commutes.find((c) => c.destination_event_id === DAY_END);

  return (
    <View style={styles.root}>
      <Screen
        title={formatDay(date)}
        subtitle={isNearDay(date) ? fromDateKey(date).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }) : undefined}
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
              <ActivityIndicator size="large" color={tokens.accent} />
              <Text variant="bodyMedium" style={{ color: tokens.muted }}>
                Planning your routes…
              </Text>
            </View>
          ) : null
        ) : (
          <>
            {/* The day at a glance: the one deep card on the screen. */}
            <View style={styles.pad}>
              <Card tone="deep" style={styles.summary}>
                {showing.commutes.length > 0 && (
                  <View style={styles.stats}>
                    {[
                      [formatDuration(showing.summary.total_commute_minutes), 'travelling'],
                      [formatCO2(showing.summary.total_co2_saved_grams), 'CO₂ saved, est.'],
                      [showing.summary.total_steps.toLocaleString(), 'steps on foot'],
                    ].map(([value, label]) => (
                      <View key={label} style={styles.stat}>
                        <Text variant="titleLarge" style={[styles.tabular, { color: tokens.onDeep }]} numberOfLines={1}>
                          {value}
                        </Text>
                        <Text variant="bodySmall" style={{ color: tokens.onDeepMuted }} numberOfLines={1}>
                          {label}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
                <View style={styles.green}>
                  <Icon source="leaf" size={20} color={tokens.onDeep} />
                  <View style={{ flex: 1 }}>
                    <Text variant="titleSmall" style={{ color: tokens.onDeep }}>
                      Green routes
                    </Text>
                    <Text variant="bodySmall" style={{ color: tokens.onDeepMuted }}>
                      {nature ? 'Walks through parks are favoured, and a park walk is offered when it is dry' : 'Routes are ranked without favouring parks'}
                    </Text>
                  </View>
                  <Switch
                    value={nature}
                    color={Blue.soft}
                    onValueChange={() => {
                      if (preferences) updatePreferences({ ...preferences, prefer_nature_routes: !nature });
                    }}
                    accessibilityLabel={`Prefer green routes: ${nature ? 'on' : 'off'}`}
                  />
                </View>
              </Card>
            </View>

            {showing.events.length === 0 ? (
              <View style={styles.center}>
                <View style={[styles.emptyIcon, { backgroundColor: tokens.pale }]}>
                  <Icon source="calendar-blank-outline" size={30} color={tokens.accent} />
                </View>
                <Text variant="titleMedium">Nothing planned</Text>
                <Text variant="bodyMedium" style={{ color: tokens.muted, textAlign: 'center' }}>
                  Add an event with the + button, or import a calendar from the Calendar tab.
                </Text>
              </View>
            ) : (
              <View style={styles.day}>
                <EndpointMarker
                  which="origin"
                  endpoint={showing.origin}
                  time={fromStart && formatTime(fromStart.departure_time)}
                  onPress={() => setEndpointDialog('origin')}
                />
                {renderCommute(fromStart)}
                {showing.events.map((event, i) => (
                  <View key={event.id}>
                    <EventBlock
                      event={event}
                      onPress={() => {
                        setEditing(event);
                        setDialog(true);
                      }}
                    />
                    {renderCommute(commuteFrom(event.id))}
                    {/* Staying put: the next event is at the same place, so a short
                        plain line joins the two blocks with nothing to say. */}
                    {!commuteFrom(event.id) && samePlace(event, showing.events[i + 1]) && (
                      <View style={styles.stay} accessibilityLabel="Same place as the next event">
                        <View style={[styles.stayLine, { backgroundColor: tokens.rail }]} />
                      </View>
                    )}
                  </View>
                ))}
                <EndpointMarker
                  which="destination"
                  endpoint={showing.destination}
                  time={toEnd && formatTime(toEnd.arrival_time)}
                  onPress={() => setEndpointDialog('destination')}
                />
              </View>
            )}
          </>
        )}
      </Screen>

      <FAB
        icon="plus"
        accessibilityLabel="Add event"
        style={[styles.fab, { backgroundColor: tokens.accent, bottom: NAV_CLEARANCE + insets.bottom + 2 }]}
        color={tokens.onAccent}
        onPress={() => {
          setEditing(null);
          setDialog(true);
        }}
      />
      <EventDialog visible={dialog} date={date} event={editing} onDismiss={() => setDialog(false)} onSaved={refresh} />
      <EndpointDialog
        visible={!!endpointDialog}
        which={endpointDialog ?? 'origin'}
        date={date}
        endpoint={(endpointDialog === 'destination' ? showing?.destination : showing?.origin) ?? null}
        onDismiss={() => setEndpointDialog(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  pad: { paddingHorizontal: Space.gutter },
  summary: { gap: 16 },
  stats: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, gap: 2 },
  green: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  day: { paddingHorizontal: Space.gutter, paddingTop: 6 },
  event: { borderRadius: Radius.card },
  eventTouch: { borderRadius: Radius.card },
  eventBody: { paddingHorizontal: Space.card, paddingVertical: 16, gap: 6, minHeight: 48 },
  eventHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  eventPlace: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeTag: { borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  // The marker is centred on the trail's rail (12dp inset + half of the 28dp rail column).
  endpoint: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingLeft: 4, paddingVertical: 2 },
  marker: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  // Lines up with the trail's rail: 12dp inset, centred in its 28dp column.
  stay: { height: 24, paddingLeft: 12, width: 40, alignItems: 'center' },
  stayLine: { flex: 1, width: 2 },
  tabular: { fontVariant: ['tabular-nums'] },
  center: { alignItems: 'center', gap: 10, paddingVertical: 56, paddingHorizontal: 32 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  fab: { position: 'absolute', right: 18, borderRadius: 28 },
});
