import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Icon, IconButton, Snackbar, Text, TouchableRipple } from 'react-native-paper';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../store/AppContext';
import { TripMap } from '../components/TripMap';
import { LinePill } from '../components/CommuteCard';
import { useLiveLocation } from '../hooks/useLiveLocation';
import { NAV_CLEARANCE, Radius, cardShadow, modeIcon, useAppTheme, useTokens } from '../theme';
import { IntermodalNode } from '../types';
import { commuteKey, currentCommute, formatDay, formatDuration, formatTime } from '../utils/format';
import { easeLayout } from '../utils/motion';

const LOCATION_NOTE = {
  asking: 'Still finding where you are…',
  denied: 'Location access was refused. Allow it in the settings to see yourself on the map.',
  unavailable: 'This device cannot report its location.',
} as const;

// One stretch of the trip in the list under the map.
const Step: React.FC<{ leg: IntermodalNode; selected: boolean; onPress: () => void }> = ({ leg, selected, onPress }) => {
  const tokens = useTokens();
  const walking = leg.mode === 'walk';
  const stops = (leg.intermediate_stops?.length ?? 0) + 1;
  return (
    <TouchableRipple
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${walking ? 'Walk' : leg.transit_line ?? leg.mode}, ${leg.duration_minutes} minutes. Show this part on the map.`}
      style={[styles.step, selected && { backgroundColor: tokens.pale }]}
    >
      <View style={styles.stepRow}>
        <View style={styles.stepIcon}>
          {!walking && leg.line_code ? (
            <LinePill node={leg} />
          ) : (
            <Icon source={modeIcon(leg.mode)} size={22} color={walking ? tokens.accent : tokens.post} />
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="titleSmall" numberOfLines={1}>
            {walking ? `Walk ${leg.duration_minutes} min` : leg.line_name || leg.transit_line || leg.mode}
          </Text>
          <Text variant="bodySmall" style={{ color: tokens.muted }} numberOfLines={1}>
            {walking
              ? `to ${leg.to_stop_name || 'your destination'}`
              : `${leg.station_or_stop_name ?? ''} → ${leg.to_stop_name ?? ''} · ${stops} stop${stops > 1 ? 's' : ''} · ${leg.duration_minutes} min`}
          </Text>
        </View>
        <Text variant="bodyMedium" style={[styles.tabular, { color: tokens.muted }]}>
          {formatTime(leg.departure_time)}
        </Text>
      </View>
    </TouchableRipple>
  );
};

// The trip on a map: where the user is, the route drawn section by section,
// and the steps listed underneath. It shows the trip that is open on the Day
// tab, or else the one that matters now; the arrows move through the day's trips.
export const MapScreen: React.FC = () => {
  const theme = useAppTheme();
  const tokens = useTokens();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const { schedule, date, openCommute, setOpenCommute } = useApp();
  const { position, status } = useLiveLocation(focused);
  const [steps, setSteps] = useState(true); // the list under the map is open
  const [focus, setFocus] = useState<{ leg: number | null; nonce: number }>({ leg: null, nonce: 0 });
  const [locate, setLocate] = useState(0);
  const [notice, setNotice] = useState('');

  const commutes = schedule?.commutes ?? [];
  const index = Math.max(
    0,
    commutes.findIndex((c) => commuteKey(c) === openCommute) >= 0
      ? commutes.findIndex((c) => commuteKey(c) === openCommute)
      : commutes.indexOf(currentCommute(commutes) ?? commutes[0])
  );
  const route = commutes[index] ?? null;
  const routeId = route?.id;
  const legs = (route?.nodes ?? []).filter((n) => n.polyline); // the same stretches the map draws
  const to = route
    ? schedule?.events.find((e) => e.id === route.destination_event_id)?.title ??
      (schedule?.destination?.is_home ? 'Home' : route.destination_location.name)
    : '';

  // Another trip: show the whole of it again.
  useEffect(() => setFocus({ leg: null, nonce: 0 }), [routeId]);

  const go = (step: 1 | -1) => {
    const next = commutes[index + step];
    if (next) setOpenCommute(commuteKey(next));
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <View style={styles.map}>
        <TripMap route={route} position={position} focus={focus} locate={locate} />

        {/* Which trip this is, with arrows to the day's other trips. */}
        <View style={[styles.header, { top: insets.top + 10, backgroundColor: tokens.card }, cardShadow(theme.dark)]}>
          <IconButton icon="chevron-left" accessibilityLabel="Previous trip" disabled={index <= 0} onPress={() => go(-1)} />
          <View style={styles.headerText}>
            <Text variant="titleSmall" numberOfLines={1}>
              {route ? `To ${to}` : `No trips planned for ${formatDay(date).toLowerCase()}`}
            </Text>
            {route && (
              <Text variant="bodySmall" style={[styles.tabular, { color: tokens.muted }]} numberOfLines={1}>
                leave {formatTime(route.departure_time)} · {formatDuration(route.total_duration_minutes)} · arrive{' '}
                {formatTime(route.arrival_time)}
              </Text>
            )}
          </View>
          <IconButton icon="chevron-right" accessibilityLabel="Next trip" disabled={index >= commutes.length - 1} onPress={() => go(1)} />
        </View>

        <View style={styles.buttons}>
          {route && (
            <IconButton
              mode="contained"
              icon="map-marker-path"
              containerColor={tokens.card}
              iconColor={tokens.post}
              accessibilityLabel="Show the whole trip"
              style={cardShadow(theme.dark)}
              onPress={() => setFocus((f) => ({ leg: null, nonce: f.nonce + 1 }))}
            />
          )}
          <IconButton
            mode="contained"
            icon={position ? 'crosshairs-gps' : 'crosshairs'}
            containerColor={tokens.card}
            iconColor={position ? '#1A73E8' : tokens.muted}
            accessibilityLabel="Show where I am"
            style={cardShadow(theme.dark)}
            onPress={() => (position ? setLocate((n) => n + 1) : setNotice(LOCATION_NOTE[status === 'on' ? 'asking' : status]))}
          />
        </View>
      </View>

      {/* The steps, in the manner of a directions panel. */}
      <View style={[styles.sheet, { backgroundColor: tokens.card, paddingBottom: NAV_CLEARANCE + insets.bottom }]}>
        {route ? (
          <>
            <TouchableRipple
              onPress={() => {
                easeLayout();
                setSteps((v) => !v);
              }}
              accessibilityRole="button"
              accessibilityState={{ expanded: steps }}
              accessibilityLabel={`${steps ? 'Hide' : 'Show'} the steps of this trip`}
            >
              <View style={styles.summary}>
                <View style={styles.modes}>
                  {legs.map((leg, i) => (
                    <React.Fragment key={leg.id || i}>
                      {i > 0 && <Icon source="chevron-right" size={16} color={tokens.muted} />}
                      {leg.mode !== 'walk' && leg.line_code ? (
                        <LinePill node={leg} />
                      ) : (
                        <Icon source={modeIcon(leg.mode)} size={20} color={leg.mode === 'walk' ? tokens.accent : tokens.post} />
                      )}
                    </React.Fragment>
                  ))}
                </View>
                <Text variant="titleSmall" style={styles.tabular}>
                  {formatDuration(route.total_duration_minutes)}
                </Text>
                <Icon source={steps ? 'chevron-down' : 'chevron-up'} size={22} color={tokens.muted} />
              </View>
            </TouchableRipple>
            {steps && (
              <ScrollView style={styles.steps}>
                {legs.map((leg, i) => (
                  <Step
                    key={leg.id || i}
                    leg={leg}
                    selected={focus.leg === i}
                    onPress={() => setFocus((f) => ({ leg: f.leg === i ? null : i, nonce: f.nonce + 1 }))}
                  />
                ))}
                <View style={styles.stepRow}>
                  <View style={styles.stepIcon}>
                    <Icon source="map-marker" size={22} color="#EA4335" />
                  </View>
                  <Text variant="titleSmall" style={{ flex: 1 }} numberOfLines={1}>
                    {to}
                  </Text>
                  <Text variant="bodyMedium" style={[styles.tabular, { color: tokens.muted }]}>
                    {formatTime(route.arrival_time)}
                  </Text>
                </View>
              </ScrollView>
            )}
          </>
        ) : (
          <Text variant="bodyMedium" style={[styles.empty, { color: tokens.muted }]}>
            Add events with addresses on the Day tab and their routes appear here.
          </Text>
        )}
      </View>

      <Snackbar visible={!!notice} onDismiss={() => setNotice('')} duration={4000} wrapperStyle={{ bottom: NAV_CLEARANCE }}>
        {notice}
      </Snackbar>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  map: { flex: 1 },
  header: {
    position: 'absolute',
    left: 12,
    right: 12,
    maxWidth: 560,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.card,
    minHeight: 56,
  },
  headerText: { flex: 1, minWidth: 0, alignItems: 'center' },
  buttons: { position: 'absolute', right: 8, bottom: 22, gap: 2 },
  sheet: { borderTopLeftRadius: Radius.card, borderTopRightRadius: Radius.card, paddingTop: 4 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 18 },
  modes: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  steps: { maxHeight: 236 },
  step: { paddingHorizontal: 0 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 18, paddingVertical: 6 },
  stepIcon: { width: 44, alignItems: 'center' },
  empty: { paddingHorizontal: 18, paddingVertical: 16 },
  tabular: { fontVariant: ['tabular-nums'] },
});
