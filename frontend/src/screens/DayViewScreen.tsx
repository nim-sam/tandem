import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ActivityIndicator, FAB, Icon, IconButton, Snackbar, Text, TouchableRipple } from 'react-native-paper';
import { DatePickerModal } from 'react-native-paper-dates';
import { useApp } from '../store/AppContext';
import { Screen } from '../components/Screen';
import { CommuteCard } from '../components/CommuteCard';
import { EventDialog } from '../components/EventDialog';
import { EndpointDialog } from '../components/EndpointDialog';
import { useLeaveNotifications } from '../hooks/useLeaveNotifications';
import { Blue, Font, LineColor, NAV_CLEARANCE, Radius, Space, cardShadow, endpointIcon, glass, useAppTheme, useTokens } from '../theme';
import { GreenRouteDialog } from '../components/GreenRouteDialog';
import { Anchor, WidgetOptions } from '../components/WidgetOptions';
import { API } from '../api/client';
import { Card } from '../components/Card';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DAY_END, DAY_START, DayEndpoint, EndpointKind, Event, Route } from '../types';
import {
  addDays,
  commuteKey,
  currentCommute,
  formatCO2,
  formatDay,
  formatTime,
  fromDateKey,
  isNearDay,
  toDateKey,
  todayKey,
} from '../utils/format';

// "2h 5m": a duration short enough for a third of the summary card.
const shortDuration = (minutes: number): string => (minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes} min`);

type ViewRef = React.ComponentRef<typeof View>;

// Where a view sits on screen. (On web a view's ref is its DOM node.)
const rectOf = (view: ViewRef | null): Promise<Anchor | null> =>
  new Promise((resolve) => {
    if (!view) return resolve(null);
    if (Platform.OS === 'web') {
      const r = (view as unknown as HTMLElement).getBoundingClientRect();
      return resolve({ x: r.left, y: r.top, width: r.width, height: r.height });
    }
    view.measureInWindow((x: number, y: number, width: number, height: number) => resolve({ x, y, width, height }));
  });

// Its top edge only.
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

// An event is a frosted card; the line to the next event leaves from under it.
// Tapping it opens the event's details. `here` marks it as where the user is
// now: its name in bold, with the dot beside it. Its place is shown only while
// a trip to or from it is open (`open`).
const EventBlock: React.FC<{ event: Event; here?: boolean; open?: boolean; onPress?: () => void; onLongPress?: () => void }> = ({
  event,
  here,
  open,
  onPress,
  onLongPress,
}) => {
  const theme = useAppTheme();
  const tokens = useTokens();
  const located = !!(event.location.latitude || event.location.longitude);
  return (
    <View style={[styles.event, cardShadow(theme.dark), glass(theme.dark)]}>
      {here && <HereDot />}
      <TouchableRipple
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={320}
        borderless
        accessibilityRole="button"
        accessibilityLabel={`${event.title}, ${formatTime(event.start_time)} to ${formatTime(event.end_time)}${
          here ? ', where you are now' : ''
        }. Show details.`}
        accessibilityHint="Hold for options: optimise the trip from here, or say you finished early"
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
          {(open || (!located && !!event.location.name)) && (
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
          )}
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
  open?: boolean; // the trip from or to it is open: show the address and the time
  onPress?: () => void;
  onLongPress?: () => void;
}> = ({ which, endpoint, time, here, open, onPress, onLongPress }) => {
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
      onLongPress={onLongPress}
      delayLongPress={320}
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
              ? [cardShadow(theme.dark), glass(theme.dark)]
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
          {!!detail && (open || !endpoint) && (
            <Text variant="bodySmall" style={{ color: tokens.muted }} numberOfLines={1}>
              {detail}
            </Text>
          )}
        </View>
        {!!time && open && (
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
  const { date, setDate, schedule, loading, error, refresh, selectRoute, openCommute, setOpenCommute, setCommuteGreen, setCommuteGoal } = useApp();
  const [editing, setEditing] = useState<Event | null>(null);
  const [dialog, setDialog] = useState(false);
  const [selectError, setSelectError] = useState<string | null>(null);
  const [endpointDialog, setEndpointDialog] = useState<EndpointKind | null>(null);
  const [pickingDay, setPickingDay] = useState(false);
  const [offer, setOffer] = useState<{ current: Route; to: string; proposed: Route | null; error?: string } | null>(null);
  const [applying, setApplying] = useState(false);
  const [held, setHeld] = useState<{ anchor: Anchor; event: Event | null; widget: React.ReactNode; route?: Route } | null>(null);
  const [notice, setNotice] = useState('');

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
  const blocks = useRef(new Map<string, ViewRef | null>()); // the widgets that can be held, by event id
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

  // The widgets at each end of the open trip show their place and time.
  const openRoute = showing?.commutes.find((c) => commuteKey(c) === openCommute);
  const openFrom = openRoute?.origin_event_id;
  const openTo = openRoute?.destination_event_id;

  // What a trip goes to, in words.
  const nameOfDestination = (route: Route): string =>
    showing?.events.find((e) => e.id === route.destination_event_id)?.title ??
    (showing?.destination?.is_home ? 'home' : route.destination_location.name);

  // "Optimize for Nature" on a trip asks first: the greener way is worked out
  // and shown with what it changes. Switching it back off needs no question.
  const askGreen = (route: Route) => {
    setSelectError(null);
    if (route.green_routes) {
      setCommuteGreen(route, false)
        .then(() => setNotice('Nature is off for that trip.'))
        .catch((e) => setSelectError(e instanceof Error ? e.message : String(e)));
      return;
    }
    setOffer({ current: route, to: nameOfDestination(route), proposed: null });
    API.previewCommuteGreen(date, route.origin_event_id ?? '', route.destination_event_id ?? '', true)
      .then((proposed) => setOffer((o) => (o && o.current.id === route.id ? { ...o, proposed } : o)))
      .catch((e) => setOffer((o) => (o ? { ...o, error: e instanceof Error ? e.message : String(e) } : o)));
  };

  // Holding a widget lifts it out with its options (see WidgetOptions).
  const hold = async (key: string, event: Event | null, widget: React.ReactNode) => {
    const anchor = await rectOf(blocks.current.get(key) ?? null);
    if (anchor) setHeld({ anchor, event, widget, route: commuteFrom(event ? event.id : DAY_START) });
  };
  const applyGreen = () => {
    if (!offer) return;
    setApplying(true);
    setCommuteGreen(offer.current, true)
      .then(() => setOffer(null))
      .catch((e) => setOffer((o) => (o ? { ...o, error: e instanceof Error ? e.message : String(e) } : o)))
      .finally(() => setApplying(false));
  };
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
            {/* The day at a glance: three figures, each under its icon. */}
            {showing.commutes.length > 0 && (
              <View style={styles.pad}>
                <Card frosted style={styles.summary}>
                  <Text variant="labelMedium" style={{ color: tokens.muted }}>
                    {date === todayKey()
                      ? "Today's commute"
                      : isNearDay(date)
                        ? `${formatDay(date)}'s commute`
                        : `Commute on ${formatDay(date)}`}
                  </Text>
                  <View style={styles.stats}>
                    {(
                      [
                        ['clock-outline', LineColor.blueLine, shortDuration(showing.summary.total_commute_minutes), 'Time Travelled'],
                        ['leaf', LineColor.rem, formatCO2(showing.summary.total_co2_saved_grams), 'CO₂ Saved'],
                        ['shoe-print', LineColor.rtl, showing.summary.total_steps.toLocaleString(), 'Steps Walked'],
                      ] as const
                    ).map(([icon, color, value, label]) => (
                      <View key={label} style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
                        <Icon source={icon} size={20} color={color} />
                        <Text variant="titleMedium" style={[styles.tabular, styles.statValue, { color: tokens.post }]} numberOfLines={1}>
                          {value}
                        </Text>
                        <Text variant="labelSmall" style={{ color: tokens.muted, textAlign: 'center' }} numberOfLines={2}>
                          {label}
                        </Text>
                      </View>
                    ))}
                  </View>
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
                <View ref={(view) => void blocks.current.set(DAY_START, view)} collapsable={false}>
                  <EndpointMarker
                    which="origin"
                    endpoint={showing.origin}
                    time={fromStart && formatTime(fromStart.departure_time)}
                    here={here === DAY_START}
                    open={openFrom === DAY_START}
                    onPress={() => setEndpointDialog('origin')}
                    onLongPress={
                      showing.origin
                        ? () => hold(DAY_START, null, <EndpointMarker which="origin" endpoint={showing.origin} here={here === DAY_START} open />)
                        : undefined
                    }
                  />
                </View>
                {renderCommute(fromStart)}
                {showing.events.map((event, i) => (
                  <View key={event.id}>
                    <View ref={(view) => void blocks.current.set(event.id, view)} collapsable={false}>
                      <EventBlock
                        event={event}
                        here={here === event.id}
                        open={openFrom === event.id || openTo === event.id}
                        onPress={() => {
                          setEditing(event);
                          setDialog(true);
                        }}
                        onLongPress={() => hold(event.id, event, <EventBlock event={event} here={here === event.id} open />)}
                      />
                    </View>
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
                  open={openTo === DAY_END}
                  onPress={() => setEndpointDialog('destination')}
                />
              </View>
            )}
          </View>
        )}
      </Screen>

      {held && (
        <WidgetOptions
          anchor={held.anchor}
          widget={held.widget}
          event={held.event}
          route={held.route}
          onNature={(route) => {
            setHeld(null);
            askGreen(route);
          }}
          onGoal={async (route, goal) => {
            await setCommuteGoal(route, goal);
            setNotice(goal === 'steps' ? 'That trip now takes the way with the most steps.' : goal === 'co2' ? 'That trip now takes the way that saves the most CO₂.' : 'That trip is back to your usual ranking.');
          }}
          onStopAdded={(message) => {
            setHeld(null);
            setNotice(message);
            refresh();
          }}
          onClose={() => setHeld(null)}
        />
      )}
      {/* above the add button, so neither covers the other */}
      <Snackbar visible={!!notice} onDismiss={() => setNotice('')} duration={4000} wrapperStyle={{ bottom: NAV_CLEARANCE + insets.bottom + 54 }}>
        {notice}
      </Snackbar>
      <GreenRouteDialog
        visible={!!offer}
        to={offer?.to ?? ''}
        current={offer?.current ?? null}
        proposed={offer?.proposed ?? null}
        error={offer?.error}
        applying={applying}
        onApply={applyGreen}
        onDismiss={() => setOffer(null)}
      />
      <FAB
        icon="plus"
        customSize={48}
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
  summary: { gap: 12, paddingVertical: 14 },
  stats: { flexDirection: 'row', gap: 6 },
  stat: { flex: 1, gap: 3, alignItems: 'center' }, // three equal columns: icon, figure, caption
  content: { gap: Space.gap },
  // in the screen's gutter, level with the middle of the block it marks
  hereDot: { position: 'absolute', left: -14, top: '50%', marginTop: -4, width: 8, height: 8, borderRadius: 4 },
  statValue: { fontFamily: Font.bold, marginTop: 2 },
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
  fab: { position: 'absolute', right: 18, borderRadius: 24 },
});
