import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Icon, Text, TouchableRipple } from 'react-native-paper';
import { DAY_END, DAY_START, IntermodalNode, Route } from '../types';
import { Font, Radius, cardShadow, inkOn, lineColor, useAppTheme, useTokens } from '../theme';
import { formatCO2, formatDuration, formatTime } from '../utils/format';
import { easeLayout } from '../utils/motion';
import { RouteMap } from './RouteMap';
import { useApp } from '../store/AppContext';

const RAIL = 28; // width of the column the line runs down

export const lineSummary = (route: Route): string => {
  if (route.is_park_walk) return `Walk via ${route.nodes[0]?.to_stop_name ?? 'the park'}`;
  const lines = route.nodes.filter((n) => n.mode !== 'walk').map((n) => n.transit_line);
  return lines.length ? lines.join(' → ') : 'Walk';
};

// The line's number or letter as it is printed on the vehicle and the signs
// (bus 144, metro 2, REM A1, train 12), on the colour its agency gives it.
export const LinePill: React.FC<{ node: IntermodalNode }> = ({ node }) => {
  const theme = useAppTheme();
  if (!node.line_code) return null;
  const fill = lineColor(node.mode, node.route_color, theme.dark);
  return (
    <View style={[styles.linePill, { backgroundColor: fill }]}>
      <Text variant="labelLarge" numberOfLines={1} style={[styles.tabular, styles.lineCode, { color: inkOn(fill) }]}>
        {node.line_code}
      </Text>
    </View>
  );
};

// The walking counterpart of a line pill: same size, a walker instead of a code.
// With green routes on, the walker is green on a walk through a park.
const WalkPill: React.FC<{ green?: boolean }> = ({ green }) => {
  const tokens = useTokens();
  return (
    <View style={[styles.linePill, { backgroundColor: tokens.pale }]}>
      <Icon source="walk" size={16} color={green ? tokens.green : tokens.accent} />
    </View>
  );
};

// A walk between two consecutive lines (changing platforms, crossing to the
// bus stop) is not drawn: the dot for that station already says "change here".
// Only a long one, a real walk between stations, is kept.
const TRANSFER_WALK_MAX_MIN = 5;

const visibleLegs = (nodes: IntermodalNode[]): IntermodalNode[] =>
  nodes.filter(
    (n, i) => n.mode !== 'walk' || i === 0 || i === nodes.length - 1 || n.duration_minutes > TRANSFER_WALK_MAX_MIN
  );

// A stretch of the line: dotted for walking, solid in the line's colour for a
// vehicle. Tapping a vehicle stretch lists the stops it passes, in order.
// `header` and `footer` are drawn in the same row, above and below the
// segment's own line of text, alongside the same stretch of line.
const Segment: React.FC<{
  node: IntermodalNode;
  green?: boolean; // green routes are on
  parkWalk?: boolean; // the whole route is a walk through a park
  header?: React.ReactNode;
  footer?: React.ReactNode;
}> = ({
  node,
  green,
  parkWalk,
  header,
  footer,
}) => {
  const theme = useAppTheme();
  const tokens = useTokens();
  const [open, setOpen] = useState(false);
  const walking = node.mode === 'walk';
  const late = (node.delay_minutes ?? 0) > 0;
  const color = lineColor(node.mode, node.route_color, theme.dark);
  const passed = node.intermediate_stops ?? [];
  const showCodes = node.mode === 'bus'; // stop numbers are printed on bus stop signs
  const throughPark = walking && !!node.green_spaces?.length && node.nature_score >= 0.2;
  const label = walking ? (throughPark ? `Walk via ${node.green_spaces![0]}` : 'Walk') : node.transit_line;

  // With a pill, the text beside it is only the line's name ("Des Pins").
  const text = !walking && node.line_code ? node.line_name ?? '' : label;

  const summary = (
    <View style={styles.segment}>
      {walking ? <WalkPill green={green && (throughPark || parkWalk)} /> : <LinePill node={node} />}
      {!!text && (
        <Text variant="bodyMedium" numberOfLines={1} style={{ flexShrink: 1, color: walking ? tokens.muted : theme.colors.onSurface }}>
          {text}
        </Text>
      )}
      <Text variant="bodySmall" numberOfLines={1} style={[styles.tabular, { color: tokens.muted, flexShrink: 0 }]}>
        {node.duration_minutes} min
        {!walking && passed.length > 0 ? ` · ${passed.length + 1} stops` : ''}
      </Text>
      {!walking && node.real_time && (
        <Text variant="bodySmall" style={{ color: late ? tokens.warn : tokens.offer }}>
          {late ? `${node.delay_minutes} min late` : 'on time'}
        </Text>
      )}
      {!walking && !node.elevator_available && (
        <View accessible accessibilityLabel={node.accessibility_notes || 'Not step-free'}>
          <Icon source="stairs" size={16} color={tokens.warn} />
        </View>
      )}
      {!walking && passed.length > 0 && (
        <>
          <View style={{ flex: 1 }} />
          <Icon source={open ? 'chevron-up' : 'chevron-down'} size={20} color={tokens.muted} />
        </>
      )}
    </View>
  );

  return (
    <View style={styles.row}>
      <View style={styles.rail}>
        {walking ? (
          <View style={[styles.dotted, { borderColor: tokens.soft }]} />
        ) : (
          <View style={[styles.solid, { backgroundColor: color }]} />
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        {!!header && <View style={styles.joined}>{header}</View>}
        {walking || passed.length === 0 ? (
          summary
        ) : (
          <TouchableRipple
            onPress={() => {
              easeLayout();
              setOpen((v) => !v);
            }}
            style={styles.segmentTarget}
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            accessibilityLabel={`${label}, ${node.duration_minutes} minutes. ${open ? 'Hide' : 'Show'} the ${
              passed.length
            } stop${passed.length > 1 ? 's' : ''} it passes.`}
          >
            {summary}
          </TouchableRipple>
        )}
        {open &&
          passed.map((stop, i) => (
            <View key={`${stop.name}-${i}`} style={styles.passed}>
              <View style={[styles.tick, { backgroundColor: color }]} />
              <Text variant="bodySmall" style={{ flex: 1, color: tokens.muted }} numberOfLines={1}>
                {stop.name}
                {showCodes && stop.code ? `  ·  stop ${stop.code}` : ''}
              </Text>
              <Text variant="bodySmall" style={[styles.tabular, { color: tokens.muted }]}>
                {formatTime(stop.time)}
              </Text>
            </View>
          ))}
        {!!footer && <View style={styles.joined}>{footer}</View>}
      </View>
    </View>
  );
};

// A change of mode: a small dot labelled with the station or stop (and, for a
// bus stop, the number on its sign).
const Stop: React.FC<{ name: string; code?: string; time: string }> = ({ name, code, time }) => {
  const theme = useAppTheme();
  return (
    <View style={styles.row}>
      <View style={styles.rail}>
        <View style={[styles.dot, { borderColor: theme.colors.primary, backgroundColor: theme.colors.surface }]} />
      </View>
      <View style={styles.stop}>
        <Text variant="titleSmall" style={{ flex: 1 }} numberOfLines={1}>
          {name}
          {code ? (
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {'  '}stop {code}
            </Text>
          ) : null}
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
  const { preferences } = useApp();
  // Green routes are switched off by the server in rain, snow or deep cold.
  const greenOn = !!preferences?.prefer_nature_routes && route.weather?.good_for_outdoors !== false;
  const alternatives = route.alternatives ?? [];
  const places = route.suggested_third_places ?? [];
  const legs = visibleLegs(route.nodes);
  const first = legs[0];
  const last = legs[legs.length - 1];
  const fromStart = route.origin_event_id === DAY_START;
  const toEnd = route.destination_event_id === DAY_END;
  const warning =
    route.source === 'mock'
      ? 'Offline demo data, not real directions'
      : route.is_tight
        ? 'Does not fit between these events'
        : null;

  // When the trip leaves the day's start (or reaches its end) on foot, the
  // times line (or the details) is drawn inside that walk's own row, so the
  // dotted line is one unbroken segment between the marker and the first stop.
  const joinStart = fromStart && first?.mode === 'walk';
  const joinEnd = toEnd && last?.mode === 'walk';

  const timesBlock = (
    <>
        {/* The day's start and end markers already say when to leave home and
            when the trip back arrives, so those times are not repeated here. */}
        <Text
          variant="bodyMedium"
          style={[styles.tabular, styles.times, { color: tokens.muted }]}
          accessibilityLabel={`Leave at ${formatTime(route.departure_time)}. ${formatDuration(
            route.total_duration_minutes
          )}, arrive ${formatTime(route.arrival_time)}.`}
        >
          {!fromStart && (
            <>
              leave <Text variant="titleSmall" style={{ color: theme.colors.onSurface }}>{formatTime(route.departure_time)}</Text>
              {'  ·  '}
            </>
          )}
          {formatDuration(route.total_duration_minutes)}
          {!toEnd && (
            <>
              {'  ·  '}arrive <Text variant="titleSmall" style={{ color: theme.colors.onSurface }}>{formatTime(route.arrival_time)}</Text>
            </>
          )}
        </Text>
        {warning && (
          <View style={styles.warning}>
            <Icon source="alert-outline" size={16} color={tokens.warn} />
            <Text variant="bodySmall" style={{ color: tokens.warn, flexShrink: 1 }}>
              {warning}
            </Text>
          </View>
        )}
    </>
  );

  const detailsBlock = (
    <>
        <View style={styles.actions}>
          <Button
            mode="text"
            textColor={tokens.accent}
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
          <View style={[styles.details, { backgroundColor: tokens.card }, cardShadow(theme.dark)]}>
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

            {places.length > 1 && route.slack_minutes >= 10 && (
              <View style={styles.list}>
                <Text variant="labelLarge" style={{ color: tokens.offer }}>
                  Other places that fit in your {formatDuration(route.slack_minutes)} free
                </Text>
                {places.slice(1).map((place) => (
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
                        {alt.nodes.some((n) => n.mode !== 'walk' && n.line_code) ? (
                          <View style={styles.pills}>
                            {alt.nodes
                              .filter((n) => n.mode !== 'walk')
                              .map((n, i) =>
                                n.line_code ? (
                                  <LinePill key={i} node={n} />
                                ) : (
                                  <Text key={i} variant="titleSmall">
                                    {n.transit_line}
                                  </Text>
                                )
                              )}
                          </View>
                        ) : (
                          <Text variant="titleSmall" style={{ flex: 1 }} numberOfLines={2}>
                            {lineSummary(alt)}
                          </Text>
                        )}
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
    </>
  );

  return (
    <View style={styles.commute}>
      {route.slack_minutes >= 10 && places.length > 0 && (
        <Pass>
          <View style={[styles.free, { backgroundColor: tokens.pale }]}>
            <Icon source="clock-outline" size={14} color={tokens.onPale} />
            <Text variant="bodySmall" style={{ color: tokens.onPale, flex: 1 }} numberOfLines={1}>
              {formatDuration(route.slack_minutes)} free · {places[0].name}
            </Text>
            <Text variant="labelMedium" numberOfLines={1} style={[styles.tabular, { color: tokens.onPale, flexShrink: 0 }]}>
              {places[0].detour_minutes > 1 ? `+${places[0].detour_minutes} min` : 'on your way'}
            </Text>
          </View>
        </Pass>
      )}

      {!joinStart && <Pass>{timesBlock}</Pass>}

      {/* A commute from an event starts at a node naming the place. From the
          day's start there is none: its marker is that node. */}
      {first && !fromStart && (
        <Stop
          name={first.station_or_stop_name || route.origin_location.name || 'Start'}
          code={first.mode === 'bus' ? first.stop_code : undefined}
          time={formatTime(route.departure_time)}
        />
      )}
      {legs.map((leg, i) => (
        <React.Fragment key={leg.id || i}>
          {i > 0 && (
            <Stop
              // the stop where the next stretch starts; before a final walk, where you got off
              name={(leg.mode === 'walk' ? legs[i - 1].to_stop_name : leg.station_or_stop_name) ?? ''}
              code={
                leg.mode === 'bus'
                  ? leg.stop_code
                  : leg.mode === 'walk' && legs[i - 1].mode === 'bus'
                    ? legs[i - 1].to_stop_code
                    : undefined
              }
              time={formatTime(leg.departure_time)}
            />
          )}
          <Segment
            node={leg}
            green={greenOn}
            parkWalk={route.is_park_walk}
            header={i === 0 && joinStart ? timesBlock : undefined}
            footer={i === legs.length - 1 && joinEnd ? detailsBlock : undefined}
          />
        </React.Fragment>
      ))}
      {/* ...and ends at one, unless it ends at the day's end marker: then a
          final walk's dotted line carries on down to the marker. */}
      {last && !toEnd && (
        <Stop
          name={last.to_stop_name || route.destination_location.name || 'Arrive'}
          code={last.mode === 'bus' ? last.to_stop_code : undefined}
          time={formatTime(route.arrival_time)}
        />
      )}

      {!joinEnd && <Pass>{detailsBlock}</Pass>}
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
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2.5, marginVertical: 7 },
  segment: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36, paddingLeft: 8 },
  segmentTarget: { minHeight: 48, justifyContent: 'center' },
  passed: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 26, paddingLeft: 8 },
  tick: { width: 6, height: 2, marginLeft: -8, marginRight: 0 },
  stop: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 8 },
  pass: { flex: 1, paddingLeft: 8, paddingVertical: 6, minWidth: 0 },
  joined: { paddingLeft: 8, paddingVertical: 6 },
  times: { minHeight: 24 },
  linePill: { minWidth: 32, height: 24, borderRadius: Radius.tag, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  lineCode: { lineHeight: 24, fontSize: 14, fontFamily: Font.bold },
  pills: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  warning: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  actions: { flexDirection: 'row', marginLeft: -12 },
  target: { minHeight: 48 },
  free: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 6, marginTop: 4 },
  details: { gap: 12, padding: 16, borderRadius: Radius.block, marginRight: 2, marginBottom: 10 },
  list: { gap: 4 },
  place: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 24 },
  option: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 10, minHeight: 56, justifyContent: 'center', marginTop: 8 },
  optionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tabular: { fontVariant: ['tabular-nums'] },
});
