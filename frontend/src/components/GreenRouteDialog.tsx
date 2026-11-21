import React from 'react';
import { Platform, Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { ActivityIndicator, Button, Icon, Portal, Text } from 'react-native-paper';
import { LineColor, Radius, cardShadow, useAppTheme, useTokens } from '../theme';
import { Route } from '../types';
import { formatDuration, formatTime } from '../utils/format';
import { lineSummary } from './CommuteCard';

interface Props {
  visible: boolean;
  to: string; // where the trip goes
  current: Route | null; // the trip as it is now
  proposed: Route | null; // the trip with green routes on; null while it is being planned
  error?: string;
  applying?: boolean;
  onApply: () => void;
  onDismiss: () => void;
}

// What a route is made of, to tell whether two are the same trip.
const signature = (route: Route) => route.nodes.map((n) => `${n.mode}|${n.transit_line ?? ''}|${n.departure_time}`).join('>');

// The parks a route's walks go through.
const parksOf = (route: Route): string[] => [
  ...new Set(route.nodes.filter((n) => n.mode === 'walk' && n.nature_score >= 0.2).flatMap((n) => n.green_spaces ?? [])),
];

const signed = (n: number, unit: string) => `${n > 0 ? '+' : '−'}${Math.abs(n).toLocaleString()} ${unit}`;

const Change: React.FC<{ icon: string; color?: string; title: string; detail?: string }> = ({ icon, color, title, detail }) => {
  const tokens = useTokens();
  return (
    <View style={styles.change}>
      <View style={styles.changeIcon}>
        <Icon source={icon} size={20} color={color ?? tokens.muted} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="titleSmall">{title}</Text>
        {!!detail && (
          <Text variant="bodySmall" style={{ color: tokens.muted }}>
            {detail}
          </Text>
        )}
      </View>
    </View>
  );
};

// Asks before switching a trip to its green route: it says what would change
// (the way, the walking it adds, the time) and waits for a yes. The screen
// behind it is blurred while it is up.
export const GreenRouteDialog: React.FC<Props> = ({ visible, to, current, proposed, error, applying, onApply, onDismiss }) => {
  const theme = useAppTheme();
  const tokens = useTokens();
  if (!visible) return null;

  const same = !!current && !!proposed && signature(current) === signature(proposed);
  const steps = current && proposed ? proposed.total_steps - current.total_steps : 0;
  const minutes = current && proposed ? proposed.total_duration_minutes - current.total_duration_minutes : 0;
  const parks = proposed ? parksOf(proposed) : [];
  const leaves = current && proposed && formatTime(current.departure_time) !== formatTime(proposed.departure_time);
  const grams = current && proposed ? Math.round(proposed.co2_saved_grams - current.co2_saved_grams) : 0;

  return (
    <Portal>
      <Pressable style={[styles.veil, veilBlur]} onPress={onDismiss} accessibilityLabel="Close without changing the route">
        {/* taps on the card itself do not close it */}
        <Pressable style={[styles.card, { backgroundColor: tokens.card }, cardShadow(theme.dark)]} onPress={() => undefined} accessibilityRole="alert">
          <View style={styles.head}>
            <View style={[styles.leaf, { backgroundColor: LineColor.rem }]}>
              <Icon source="leaf" size={20} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="titleLarge">Green route</Text>
              <Text variant="bodyMedium" style={{ color: tokens.muted }} numberOfLines={1}>
                {current ? `For the ${formatTime(current.departure_time)} trip to ${to}` : `To ${to}`}
              </Text>
            </View>
          </View>

          {error ? (
            <Text variant="bodyMedium" style={{ color: tokens.warn }}>
              {error}
            </Text>
          ) : !proposed || !current ? (
            <View style={styles.wait}>
              <ActivityIndicator color={LineColor.rem} />
              <Text variant="bodyMedium" style={{ color: tokens.muted }}>
                Working out a greener way…
              </Text>
            </View>
          ) : same ? (
            <Text variant="bodyMedium">
              {proposed.weather && !proposed.weather.good_for_outdoors
                ? 'The weather rules out park walks for this trip, so the route stays as it is: no extra steps, no extra time.'
                : 'The greenest way for this trip is the one you already have, so nothing changes: no extra steps, no extra time.'}{' '}
              With it on, greener ways are preferred whenever this trip is planned again.
            </Text>
          ) : (
            <View style={styles.changes}>
              <Change
                icon="shoe-print"
                color={LineColor.rtl}
                title={steps === 0 ? 'The same number of steps' : `${signed(steps, 'steps')} of walking`}
                detail={
                  steps === 0
                    ? `${proposed.total_steps.toLocaleString()} steps in all`
                    : `${proposed.total_steps.toLocaleString()} steps in all, ${steps < 0 ? 'down' : 'up'} from ${current.total_steps.toLocaleString()}`
                }
              />
              <Change
                icon="clock-outline"
                color={LineColor.blueLine}
                title={minutes === 0 ? 'The same travel time' : `${signed(minutes, 'min')} of travel`}
                detail={
                  leaves
                    ? `Leave at ${formatTime(proposed.departure_time)} instead of ${formatTime(current.departure_time)}, ${formatDuration(
                        proposed.total_duration_minutes
                      )} in all`
                    : `${formatDuration(proposed.total_duration_minutes)} in all, leaving at the same time`
                }
              />
              <Change
                icon="map-marker-path"
                title={lineSummary(proposed)}
                detail={`instead of ${lineSummary(current)}`}
              />
              {parks.length > 0 && <Change icon="pine-tree" color={LineColor.rem} title={`Through ${parks.slice(0, 3).join(', ')}`} />}
              {Math.abs(grams) >= 50 && (
                <Change icon="leaf" color={LineColor.rem} title={`${signed(grams, 'g')} of CO₂ saved`} detail="An estimate, against driving" />
              )}
            </View>
          )}

          <View style={styles.actions}>
            <Button onPress={onDismiss} disabled={applying}>
              {error ? 'Close' : same ? 'Not now' : 'Keep my route'}
            </Button>
            {!error && !!proposed && (
              <Button mode="contained" buttonColor={LineColor.rem} textColor="#FFFFFF" icon="leaf" onPress={onApply} loading={applying} disabled={applying}>
                {same ? 'Turn it on' : 'Use the green route'}
              </Button>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Portal>
  );
};

// The blur is a browser feature; on a phone the veil is simply darker.
const veilBlur: ViewStyle =
  Platform.OS === 'web'
    ? ({ backgroundColor: 'rgba(13, 22, 38, 0.32)', backdropFilter: 'blur(9px)' } as ViewStyle)
    : { backgroundColor: 'rgba(13, 22, 38, 0.6)' };

const styles = StyleSheet.create({
  veil: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 440, borderRadius: Radius.card, padding: 20, gap: 16 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  leaf: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  wait: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  changes: { gap: 12 },
  change: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  changeIcon: { width: 28, alignItems: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8 },
});
