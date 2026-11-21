import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Icon, Text, TouchableRipple } from 'react-native-paper';
import { IntermodalNode, Route } from '../types';
import { lineColor, useAppTheme, useTokens } from '../theme';
import { formatCO2, formatDuration, formatTime } from '../utils/format';
import { easeLayout } from '../utils/motion';
import { RouteMap } from './RouteMap';

const RAIL = 28; // width of the column the line runs down

const lineSummary = (route: Route): string => {
  if (route.is_park_walk) return `Walk via ${route.nodes[0]?.to_stop_name ?? 'the park'}`;
  const lines = route.nodes.filter((n) => n.mode !== 'walk').map((n) => n.transit_line);
  return lines.length ? lines.join(' → ') : 'Walk';
};

// A walk between two consecutive lines (changing platforms, crossing to the
// bus stop) is not drawn: the dot for that station already says "change here".
// Only a long one, a real walk between stations, is kept.
const TRANSFER_WALK_MAX_MIN = 5;

const visibleLegs = (nodes: IntermodalNode[]): IntermodalNode[] =>
  nodes.filter(
    (n, i) => n.mode !== 'walk' || i === 0 || i === nodes.length - 1 || n.duration_minutes > TRANSFER_WALK_MAX_MIN
  );

// A stretch of the line: dotted for walking, solid in the line's colour for a vehicle.
const Segment: React.FC<{ node: IntermodalNode }> = ({ node }) => {
  const theme = useAppTheme();
  const tokens = useTokens();
  const walking = node.mode === 'walk';
  const late = (node.delay_minutes ?? 0) > 0;
  const color = lineColor(node.mode, node.route_color, theme.dark);
  const label = walking
    ? node.green_spaces?.length && node.nature_score >= 0.2
      ? `Walk via ${node.green_spaces[0]}`
      : 'Walk'
    : node.transit_line;

  return (
    <View style={styles.row}>
      <View style={styles.rail}>
        {walking ? (
          <View style={[styles.dotted, { borderColor: tokens.muted }]} />
        ) : (
          <View style={[styles.solid, { backgroundColor: color }]} />
        )}
      </View>
      <View style={styles.segment}>
        <Text variant="bodyMedium" numberOfLines={1} style={{ flexShrink: 1, color: walking ? tokens.muted : theme.colors.onSurface }}>
          {label}
        </Text>
        <Text variant="bodySmall" style={[styles.tabular, { color: tokens.muted }]}>
          {node.duration_minutes} min
        </Text>
        {!walking && node.real_time && (
          <Text variant="bodySmall" style={{ color: late ? tokens.warn : tokens.teal }}>
            {late ? `${node.delay_minutes} min late` : 'on time'}
          </Text>
        )}
        {!walking && !node.elevator_available && (
          <View accessible accessibilityLabel={node.accessibility_notes || 'Not step-free'}>
            <Icon source="stairs" size={16} color={tokens.warn} />
          </View>
        )}
      </View>
    </View>
  );
};

// A change of mode: a small dot labelled with the station or stop.
const Stop: React.FC<{ name: string; time: string }> = ({ name, time }) => {
  const theme = useAppTheme();
  return (
    <View style={styles.row}>
      <View style={styles.rail}>
        <View style={[styles.dot, { borderColor: theme.colors.onSurface, backgroundColor: theme.colors.background }]} />
      </View>
      <View style={styles.stop}>
        <Text variant="titleSmall" style={{ flex: 1 }} numberOfLines={1}>
          {name}
        </Text>
        <Text variant="titleSmall" style={[styles.tabular, { color: theme.colors.onSurfaceVariant }]}>
          {time}
        </Text>
      </View>
    </View>
  );
};

// A row that just carries the line past some content.
const Pass: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const tokens = useTokens();
  return (
    <View style={styles.row}>
      <View style={styles.rail}>
        <View style={[styles.plain, { backgroundColor: tokens.rail }]} />
      </View>
      <View style={styles.pass}>{children}</View>
    </View>
  );
};

interface Props {
  route: Route;
  onSelect: (routeId: string) => void;
}

// The trip between two events, drawn as one vertical line coming out of the
// event above: when to leave, then a dot at every change of mode with the
// stretch between dots in the line's colour. Everything else (why this route,
// CO2, steps, map, other options) is behind "Details".
export const CommuteCard: React.FC<Props> = ({ route, onSelect }) => {
  const theme = useAppTheme();
  const tokens = useTokens();
  const [open, setOpen] = useState(false);
  const alternatives = route.alternatives ?? [];
  const places = route.suggested_third_places ?? [];
  const legs = visibleLegs(route.nodes);
  const warning =
    route.source === 'mock'
      ? 'Offline demo data, not real directions'
      : route.is_tight
        ? 'Does not fit between these events'
        : null;

  return (
    <View style={styles.commute}>
      {route.slack_minutes >= 10 && places.length > 0 && (
        <Pass>
          <View style={styles.free}>
            <Text variant="bodySmall" style={{ color: tokens.teal, flexShrink: 1 }} numberOfLines={1}>
              {formatDuration(route.slack_minutes)} free · {places[0].name}
            </Text>
            <Text variant="bodySmall" numberOfLines={1} style={[styles.tabular, { color: tokens.teal, flexShrink: 0 }]}>
              {places[0].detour_minutes > 1 ? `+${places[0].detour_minutes} min` : 'on your way'}
            </Text>
          </View>
        </Pass>
      )}

      <Pass>
        <View
          style={styles.leave}
          accessible
          accessibilityLabel={`Leave at ${formatTime(route.departure_time)}. ${formatDuration(
            route.total_duration_minutes
          )}, arrive ${formatTime(route.arrival_time)}.`}
        >
          <View style={[styles.leavePill, { backgroundColor: tokens.gold }]}>
            <Text variant="titleMedium" style={{ color: tokens.onGold }}>
              Leave
            </Text>
            <Text variant="headlineMedium" style={[styles.tabular, { color: tokens.onGold }]}>
              {formatTime(route.departure_time)}
            </Text>
          </View>
          <Text variant="bodyMedium" style={[styles.tabular, { color: tokens.muted, flexShrink: 1 }]}>
            {formatDuration(route.total_duration_minutes)} · arrive {formatTime(route.arrival_time)}
          </Text>
        </View>
        {warning && (
          <View style={styles.warning}>
            <Icon source="alert-outline" size={16} color={tokens.warn} />
            <Text variant="bodySmall" style={{ color: tokens.warn, flexShrink: 1 }}>
              {warning}
            </Text>
          </View>
        )}
      </Pass>

      {legs.map((leg, i) => (
        <React.Fragment key={leg.id || i}>
          {i > 0 && (
            <Stop
              // the stop where the next stretch starts; before a final walk, where you got off
              name={(leg.mode === 'walk' ? legs[i - 1].to_stop_name : leg.station_or_stop_name) ?? ''}
              time={formatTime(leg.departure_time)}
            />
          )}
          <Segment node={leg} />
        </React.Fragment>
      ))}

      <Pass>
        <View style={styles.actions}>
          <Button
            mode="text"
            textColor={theme.colors.onSurface}
            icon={open ? 'chevron-up' : 'chevron-down'}
            contentStyle={styles.target}
            onPress={() => {
              easeLayout();
              setOpen((v) => !v);
            }}
            accessibilityLabel={open ? 'Hide route details' : 'Show route details, map and other options'}
          >
            {open ? 'Hide details' : alternatives.length ? `Details · ${alternatives.length} other options` : 'Details'}
          </Button>
        </View>

        {open && (
          <View style={styles.details}>
            <Text variant="bodyMedium">
              {route.reason}
              <Text style={{ color: tokens.muted }}>
                {route.ranked_by === 'ml-agent' ? '  ·  ranked from your past choices' : ''}
              </Text>
            </Text>
            <Text variant="bodySmall" style={{ color: tokens.muted }}>
              {[
                `about ${formatCO2(route.co2_saved_grams)} CO₂ saved (estimate)`,
                `${route.total_steps.toLocaleString()} steps`,
                route.is_accessible ? 'step-free' : 'has stairs',
                route.weather?.summary,
              ]
                .filter(Boolean)
                .join('  ·  ')}
            </Text>

            {places.length > 0 && route.slack_minutes >= 10 && (
              <View style={styles.list}>
                <Text variant="labelLarge" style={{ color: tokens.teal }}>
                  Places that fit in your {formatDuration(route.slack_minutes)} free
                </Text>
                {places.map((place) => (
                  <View key={place.id} style={styles.place}>
                    <Text variant="bodyMedium" style={{ flex: 1 }} numberOfLines={1}>
                      {place.name}
                    </Text>
                    <Text variant="bodySmall" style={[styles.tabular, { color: tokens.muted }]}>
                      {place.detour_minutes <= 1 ? 'on your way' : `+${place.detour_minutes} min`}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <RouteMap route={route} height={220} />

            {alternatives.length > 0 && (
              <View>
                <Text variant="labelLarge" style={{ color: tokens.muted }}>
                  Other ways to go. Tap one to use it.
                </Text>
                {alternatives.map((alt) => (
                  <TouchableRipple
                    key={alt.id}
                    onPress={() => {
                      easeLayout();
                      onSelect(alt.id);
                    }}
                    style={[styles.option, { borderTopColor: tokens.hairline }]}
                    accessibilityRole="button"
                    accessibilityLabel={`Use this route instead: ${lineSummary(alt)}, ${alt.total_duration_minutes} minutes`}
                  >
                    <View>
                      <View style={styles.optionHead}>
                        <Text variant="titleSmall" style={{ flex: 1 }} numberOfLines={2}>
                          {lineSummary(alt)}
                        </Text>
                        <Text variant="titleSmall" style={styles.tabular}>
                          {formatDuration(alt.total_duration_minutes)}
                        </Text>
                      </View>
                      <Text variant="bodySmall" style={{ color: alt.is_tight ? tokens.warn : tokens.muted }}>
                        Leave {formatTime(alt.departure_time)} ·{' '}
                        {alt.is_tight ? 'does not fit between these events' : alt.reason}
                      </Text>
                    </View>
                  </TouchableRipple>
                ))}
              </View>
            )}
          </View>
        )}
      </Pass>
    </View>
  );
};

const styles = StyleSheet.create({
  commute: { paddingLeft: 12 }, // the line leaves the event block a little in from its left edge
  row: { flexDirection: 'row' },
  rail: { width: RAIL, alignItems: 'center' },
  plain: { position: 'absolute', top: 0, bottom: 0, width: 2 },
  dotted: { position: 'absolute', top: 1, bottom: 1, width: 0, borderLeftWidth: 3, borderStyle: 'dotted' },
  solid: { position: 'absolute', top: 0, bottom: 0, width: 4, borderRadius: 2 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, marginVertical: 6 },
  segment: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36, paddingLeft: 8 },
  stop: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 8 },
  pass: { flex: 1, paddingLeft: 8, paddingVertical: 6, minWidth: 0 },
  leave: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  leavePill: { flexDirection: 'row', alignItems: 'baseline', gap: 8, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 4 },
  warning: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  actions: { flexDirection: 'row', marginLeft: -12 },
  target: { minHeight: 48 },
  free: { flexDirection: 'row', gap: 6 },
  details: { gap: 10, paddingTop: 8, paddingBottom: 8 },
  list: { gap: 4 },
  place: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 24 },
  option: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 10, minHeight: 56, justifyContent: 'center', marginTop: 8 },
  optionHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  tabular: { fontVariant: ['tabular-nums'] },
});
