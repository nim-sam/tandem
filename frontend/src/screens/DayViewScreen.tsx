import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ActivityIndicator, FAB, Icon, IconButton, Switch, Text, TouchableRipple } from 'react-native-paper';
import { DatePickerModal } from 'react-native-paper-dates';
import { useApp } from '../store/AppContext';
import { Screen } from '../components/Screen';
import { CommuteCard } from '../components/CommuteCard';
import { EventDialog } from '../components/EventDialog';
import { EndpointDialog } from '../components/EndpointDialog';
import { useLeaveNotifications } from '../hooks/useLeaveNotifications';
import { Blue, Font, LineColor, NAV_CLEARANCE, Radius, Space, cardShadow, endpointIcon, useAppTheme, useTokens } from '../theme';
import { Card } from '../components/Card';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DAY_END, DAY_START, DayEndpoint, EndpointKind, Event, Route } from '../types';
import {
  addDays,
  commuteKey,
  co2Equivalent,
  currentCommute,
  formatCO2,
  formatDay,
  formatDuration,
  formatTime,
  fromDateKey,
  isNearDay,
  toDateKey,
  todayKey,
} from '../utils/format';

// Where a view sits on screen, top edge. (On web a view's ref is its DOM node.)
type ViewRef = React.ComponentRef<typeof View>;

const topOf = (view: ViewRef | null): Promise<number | null> =>
  new Promise((resolve) => {
    if (!view) return resolve(null);
    if (Platform.OS === 'web') return resolve((view as unknown as HTMLElement).getBoundingClientRect().top);
    view.measureInWindow((_x: number, y: number) => resolve(y));
  });

// The dot in the margin beside the place the user is at now: white on the
// navy theme, dark blue on the light one.
const HereDot: React.FC = () => {
  const theme = useAppTheme();
  return <View style={[styles.hereDot, { backgroundColor: theme.dark ? '#FFFFFF' : Blue.deep }]} />;
};

// An event is a white card; the line to the next event leaves from under it.
// Tapping it opens the event's details. `here` marks it as where the user is
// now: its name in bold, with the dot beside it.
const EventBlock: React.FC<{ event: Event; here?: boolean; onPress: () => void }> = ({ event, here, onPress }) => {
  const theme = useAppTheme();
  const tokens = useTokens();
  const located = !!(event.location.latitude || event.location.longitude);
  return (
    <View style={[styles.event, { backgroundColor: tokens.card }, cardShadow(theme.dark)]}>
      {here && <HereDot />}
      <TouchableRipple
        onPress={onPress}
        borderless
        accessibilityRole="button"
        accessibilityLabel={`${event.title}, ${formatTime(event.start_time)} to ${formatTime(event.end_time)}${
          here ? ', where you are now' : ''
        }. Show details.`}
        style={styles.eventTouch}
      >
        <View style={styles.eventBody}>
          <View style={styles.eventHead}>
            <Text variant="titleMedium" style={[{ flex: 1 }, here && { fontFamily: Font.bold }]} numberOfLines={2}>
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
  here?: boolean; // the user is there now
  onPress: () => void;
}> = ({ which, endpoint, time, here, onPress }) => {
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
    // the dot sits outside the touchable, which clips what it contains
    <View>
    {here && <HereDot />}
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
          <Text
            variant="titleMedium"
            numberOfLines={1}
            style={[{ color: endpoint ? tokens.post : tokens.muted }, here && { fontFamily: Font.bold }]}
          >
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
    </View>
  );
};

export const DayViewScreen: React.FC = () => {
  const tokens = useTokens();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { date, setDate, schedule, loading, error, refresh, selectRoute, openCommute, setOpenCommute, setCommuteGreen } = useApp();
  const [editing, setEditing] = useState<Event | null>(null);
  const [dialog, setDialog] = useState(false);
  const [selectError, setSelectError] = useState<string | null>(null);
  const [endpointDialog, setEndpointDialog] = useState<EndpointKind | null>(null);
  const [pickingDay, setPickingDay] = useState(false);

  // Reminders are only scheduled for the real "today".
  useLeaveNotifications(date === todayKey() ? schedule : null, true);

  const commuteFrom = (originId: string): Route | undefined =>
    schedule?.commutes.find((c) => c.origin_event_id === originId);

  const choose = (routeId: string) => {
    setSelectError(null);
    selectRoute(routeId).catch((e) => setSelectError(e instanceof Error ? e.message : String(e)));
  };

  const showing = schedule && schedule.date === date ? schedule : null;

  // The trip that matters now (under way, or next to leave) is the one shown
  // open, marked with the pointer and scrolled to. The others are closed to a
  // single line; opening one closes the rest.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const current = showing ? currentCommute(showing.commutes, now) : null;
  const currentKey = current ? commuteKey(current) : null;

  const scrollRef = useRef<React.ComponentRef<typeof ScrollView> | null>(null);
  const contentRef = useRef<ViewRef | null>(null);
  const rows = useRef(new Map<string, ViewRef | null>());
  const [visit, setVisit] = useState(0); // counts each time the tab is opened
  useFocusEffect(useCallback(() => setVisit((v) => v + 1), []));

  const day = showing?.date;
  useEffect(() => {
    if (!day) return;
    setOpenCommute(currentKey);
    if (!currentKey) return;
    // Once the trip has opened and the layout settled, bring it up under the
    // title, leaving the place it leaves from in view above it.
    const timer = setTimeout(async () => {
      const [row, content] = await Promise.all([topOf(rows.current.get(currentKey) ?? null), topOf(contentRef.current)]);
      if (row === null || content === null) return;
      scrollRef.current?.scrollTo({ y: Math.max(0, row - content - 78), animated: true });
    }, 450);
    return () => clearTimeout(timer);
    // only when the tab is opened, another day is shown, or time moves on to the next trip
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, visit, currentKey]);

  const renderCommute = (route: Route | undefined) => {
    if (!route) return null;
    const key = commuteKey(route);
    return (
      <View ref={(view) => void rows.current.set(key, view)} collapsable={false}>
        <CommuteCard
          route={route}
          onSelect={choose}
          expanded={openCommute === key}
          onToggle={() => setOpenCommute(openCommute === key ? null : key)}
          onOpenMap={() => {
            setOpenCommute(key);
            navigation.navigate('Map' as never);
          }}
        />
      </View>
    );
  };

  // Where the user is now, on today's page: the event taking place, else the
  // place the next trip leaves from; once a trip is under way, where it is
  // headed; after the last trip, where it ended. An event id, DAY_START or DAY_END.
  let here: string | undefined;
  if (showing && date === todayKey()) {
    const underWay = current && new Date(current.departure_time).getTime() <= now;
    const ongoing = showing.events.find((e) => new Date(e.start_time).getTime() <= now && now <= new Date(e.end_time).getTime());
    if (underWay) here = current.destination_event_id;
    else if (ongoing) here = ongoing.id;
    else if (current) here = current.origin_event_id;
    else here = showing.commutes[showing.commutes.length - 1]?.destination_event_id;
  }

  // The green-routes switch stays in view and acts on one trip: the open one,
  // or the current one when none is open.
  const active = showing?.commutes.find((c) => commuteKey(c) === openCommute) ?? current;
  const activeTo = active
    ? showing?.events.find((e) => e.id === active.destination_event_id)?.title ??
      (showing?.destination?.is_home ? 'home' : active.destination_location.name)
    : '';
  const green = !!active?.green_routes;
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
        scrollRef={scrollRef}
        pinned={
          showing && showing.commutes.length > 0 ? (
            <View style={styles.pinned}>
              <View style={[styles.green, { backgroundColor: tokens.deep }]}>
                <Icon source="leaf" size={20} color={tokens.onDeep} />
                <View style={{ flex: 1 }}>
                  <Text variant="titleSmall" style={{ color: tokens.onDeep }}>
                    Green routes
                  </Text>
                  <Text variant="bodySmall" style={{ color: tokens.onDeepMuted }} numberOfLines={1}>
                    {active
                      ? `${green ? 'On' : 'Off'} for the ${formatTime(active.departure_time)} trip to ${activeTo}`
                      : 'Every trip of this day has arrived'}
                  </Text>
                </View>
                <Switch
                  value={green}
                  disabled={!active}
                  color={Blue.soft}
                  onValueChange={() => {
                    if (!active) return;
                    setSelectError(null);
                    setCommuteGreen(active, !green).catch((e) => setSelectError(e instanceof Error ? e.message : String(e)));
                  }}
                  accessibilityLabel={`Green routes for the trip to ${activeTo}: ${green ? 'on' : 'off'}`}
                />
              </View>
            </View>
          ) : undefined
        }
        actions={
          <>
            <IconButton icon="chevron-left" accessibilityLabel="Previous day" onPress={() => setDate(addDays(date, -1))} />
            {date !== todayKey() && (
              <IconButton icon="calendar-today" accessibilityLabel="Go to today" onPress={() => setDate(todayKey())} />
            )}
            <IconButton icon="calendar-month-outline" accessibilityLabel="Choose a day" onPress={() => setPickingDay(true)} />
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
          <View ref={contentRef} collapsable={false} style={styles.content}>
            {/* The day at a glance. */}
            {showing.commutes.length > 0 && (
            <View style={styles.pad}>
              <Card style={styles.summary}>
                {(
                  <View style={styles.stats}>
                    {[
                      [formatDuration(showing.summary.total_commute_minutes), 'travelling', '', 'clock-outline', LineColor.blueLine],
                      [
                        formatCO2(showing.summary.total_co2_saved_grams),
                        'CO₂ saved, est.',
                        co2Equivalent(showing.summary.total_co2_saved_grams, true),
                        'leaf',
                        LineColor.rem,
                      ],
                      [showing.summary.total_steps.toLocaleString(), 'steps on foot', '', 'shoe-print', LineColor.rtl],
                    ].map(([value, label, like, icon, color]) => (
                      <View key={label} style={styles.stat}>
                        <View style={styles.statValue}>
                          <Icon source={icon} size={18} color={color} />
                          <Text variant="titleLarge" style={[styles.tabular, { color: tokens.post, flexShrink: 1 }]} numberOfLines={1}>
                            {value}
                          </Text>
                        </View>
                        <Text variant="bodySmall" style={{ color: tokens.muted }} numberOfLines={1}>
                          {label}
                        </Text>
                        {!!like && (
                          <Text variant="bodySmall" style={{ color: tokens.accent, textAlign: 'center' }} numberOfLines={2}>
                            ≈ {like}
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </Card>
            </View>
            )}

            {showing.events.length === 0 ? (
              <View style={styles.center}>
                <View style={[styles.emptyIcon, { backgroundColor: tokens.pale }]}>
                  <Icon source="calendar-blank-outline" size={30} color={tokens.accent} />
                </View>
                <Text variant="titleMedium">Nothing planned</Text>
                <Text variant="bodyMedium" style={{ color: tokens.muted, textAlign: 'center' }}>
                  Add an event with the + button, or import a calendar file in Settings.
                </Text>
              </View>
            ) : (
              <View style={styles.day}>
                <EndpointMarker
                  which="origin"
                  endpoint={showing.origin}
                  time={fromStart && formatTime(fromStart.departure_time)}
                  here={here === DAY_START}
                  onPress={() => setEndpointDialog('origin')}
                />
                {renderCommute(fromStart)}
                {showing.events.map((event, i) => (
                  <View key={event.id}>
                    <EventBlock
                      event={event}
                      here={here === event.id}
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
                  here={here === DAY_END}
                  onPress={() => setEndpointDialog('destination')}
                />
              </View>
            )}
          </View>
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
      <DatePickerModal
        locale="en"
        mode="single"
        visible={pickingDay}
        date={fromDateKey(date)}
        startWeekOnMonday
        onDismiss={() => setPickingDay(false)}
        onConfirm={({ date: chosen }) => {
          if (chosen) setDate(toDateKey(chosen));
          setPickingDay(false);
        }}
      />
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
  stat: { flex: 1, gap: 2, alignItems: 'center' }, // three equal columns, each centred
  content: { gap: Space.gap },
  // in the screen's gutter, level with the middle of the block it marks
  hereDot: { position: 'absolute', left: -14, top: '50%', marginTop: -4, width: 8, height: 8, borderRadius: 4 },
  statValue: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  pinned: { paddingHorizontal: Space.gutter, paddingTop: 6, paddingBottom: 2, maxWidth: 720, width: '100%', alignSelf: 'center' },
  green: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, borderRadius: Radius.card, paddingLeft: 16, paddingRight: 10, paddingVertical: 6 },
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
