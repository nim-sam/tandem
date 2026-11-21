import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import { ActivityIndicator, Icon, Portal, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API } from '../api/client';
import { Font, LineColor, useAppTheme, useTokens } from '../theme';
import { CommuteGoal, Event, NearbyPlace, Route } from '../types';
import { formatTime } from '../utils/format';

export interface Anchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  anchor: Anchor; // where the held widget sits on screen
  widget: React.ReactNode; // the widget again, drawn over the blur in the same place
  event: Event | null; // null: the place the day starts from
  route?: Route; // the trip that leaves from this widget, if there is one
  onNature: (route: Route) => void;
  onGoal: (route: Route, goal: CommuteGoal) => Promise<void>;
  onStopAdded: (message: string) => void;
  onClose: () => void;
}

type Category = 'cafe' | 'restaurant' | 'nature';
type Level = 'root' | 'early' | Category;

const CATEGORIES: { key: Category; label: string; icon: string }[] = [
  { key: 'cafe', label: 'Café', icon: 'coffee-outline' },
  { key: 'restaurant', label: 'Restaurant', icon: 'silverware-fork-knife' },
  { key: 'nature', label: 'Nature', icon: 'pine-tree' },
];

// Words to narrow a category down with. Words in the same `group` exclude
// one another. They match what the server can test (see places/nearby.go);
// there is no price data, so "Quick bite" stands in for "cheap".
const REFINE: Record<Category, { key: string; label: string; group?: string }[]> = {
  cafe: [
    { key: 'study', label: 'Study' },
    { key: 'coffee', label: 'Coffee' },
    { key: 'bubble_tea', label: 'Bubble tea' },
    { key: 'bakery', label: 'Bakery' },
    { key: 'terrace', label: 'Terrace' },
  ],
  restaurant: [
    { key: 'quick_bite', label: 'Quick bite', group: 'service' },
    { key: 'sit_down', label: 'Sit-down', group: 'service' },
    { key: 'vegetarian', label: 'Vegetarian' },
    { key: 'terrace', label: 'Terrace' },
    { key: 'pizza', label: 'Pizza', group: 'cuisine' },
    { key: 'burgers', label: 'Burgers', group: 'cuisine' },
    { key: 'sushi', label: 'Sushi', group: 'cuisine' },
    { key: 'asian', label: 'Asian', group: 'cuisine' },
    { key: 'italian', label: 'Italian', group: 'cuisine' },
    { key: 'mexican', label: 'Mexican', group: 'cuisine' },
    { key: 'middle_eastern', label: 'Middle Eastern', group: 'cuisine' },
  ],
  nature: [
    { key: 'large', label: 'Large park', group: 'size' },
    { key: 'small', label: 'Small park', group: 'size' },
  ],
};

const EASE = Easing.out(Easing.cubic);

// Fades and lifts its content into place; `delay` staggers a list.
const Rise: React.FC<{ delay?: number; children: React.ReactNode; style?: ViewStyle }> = ({ delay = 0, children, style }) => {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: 260, delay, easing: EASE, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [t, delay]);
  return (
    <Animated.View style={[style, { opacity: t, transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
};

// One option: an icon and a line of text, straight on the blur. No box.
const Option: React.FC<{
  icon: string;
  color?: string;
  label: string;
  note?: string;
  active?: boolean;
  disabled?: boolean;
  busy?: boolean;
  trailing?: string;
  onPress: () => void;
}> = ({ icon, color, label, note, active, disabled, busy, trailing, onPress }) => {
  const tokens = useTokens();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, selected: !!active }}
      accessibilityLabel={`${label}${note ? `. ${note}` : ''}`}
      style={({ pressed }) => [styles.option, { opacity: disabled ? 0.38 : pressed ? 0.55 : 1 }]}
    >
      <View style={styles.optionIcon}>
        {busy ? <ActivityIndicator size={18} color={color ?? tokens.accent} /> : <Icon source={icon} size={24} color={color ?? tokens.post} />}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="titleMedium" numberOfLines={1} style={{ color: tokens.post, fontFamily: active ? Font.bold : Font.medium }}>
          {label}
        </Text>
        {!!note && (
          <Text variant="bodySmall" numberOfLines={1} style={{ color: active ? color ?? tokens.accent : tokens.muted }}>
            {note}
          </Text>
        )}
      </View>
      {!!trailing && (
        <Text variant="bodySmall" style={[styles.tabular, { color: tokens.muted }]}>
          {trailing}
        </Text>
      )}
    </Pressable>
  );
};

// Holding a widget on the Day tab lifts it out: everything else blurs away and
// its options appear in the free space under it, or over it when there is
// more room there. From the top: optimise the trip that leaves from it (for
// nature, steps or CO2 saved), or say the event finished early and pick
// somewhere to go in the time that frees up.
export const WidgetOptions: React.FC<Props> = ({ anchor, widget, event, route, onNature, onGoal, onStopAdded, onClose }) => {
  const theme = useAppTheme();
  const tokens = useTokens();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const veil = useRef(new Animated.Value(0)).current;
  const [level, setLevel] = useState<Level>('root');
  const [refine, setRefine] = useState<string[]>([]);
  const [places, setPlaces] = useState<NearbyPlace[] | null>(null);
  const [picks, setPicks] = useState<NearbyPlace[]>([]);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<NearbyPlace[]>([]);
  const [busy, setBusy] = useState(''); // what is being saved: an option key or a place name
  const [error, setError] = useState('');

  useEffect(() => {
    Animated.timing(veil, { toValue: 1, duration: 220, easing: EASE, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [veil]);
  const close = () => {
    Animated.timing(veil, { toValue: 0, duration: 160, easing: EASE, useNativeDriver: Platform.OS !== 'web' }).start(() => onClose());
  };

  const located = !!event && !!(event.location.latitude || event.location.longitude);

  // The user's favourites, for the "finished early" page.
  useEffect(() => {
    if (level === 'early') API.placePicks().then((r) => setPicks(r.places)).catch(() => setPicks([]));
  }, [level]);

  // Places of the chosen category near the event, narrowed down as words are picked.
  useEffect(() => {
    if (level === 'root' || level === 'early' || !event) return;
    let current = true;
    setPlaces(null);
    API.nearbyPlaces(event.location.latitude, event.location.longitude, level, refine)
      .then((r) => current && setPlaces(r.places))
      .catch((e) => current && (setPlaces([]), setError(e instanceof Error ? e.message : String(e))));
    return () => {
      current = false;
    };
  }, [level, refine, event]);

  // Search as you type, a moment after the last key.
  useEffect(() => {
    const text = query.trim();
    if (text.length < 3) {
      setFound([]);
      return;
    }
    let current = true;
    const timer = setTimeout(() => {
      API.suggestPlaces(text)
        .then((r) => current && setFound(r.suggestions.map((l) => ({ name: l.name, category: '' as const, kind: l.address ?? '', location: l }))))
        .catch(() => current && setFound([]));
    }, 280);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query]);

  const toggleRefine = (key: string, group?: string) =>
    setRefine((list) => {
      if (list.includes(key)) return list.filter((k) => k !== key);
      const rivals = group && level !== 'root' && level !== 'early' ? REFINE[level].filter((r) => r.group === group).map((r) => r.key) : [];
      return [...list.filter((k) => !rivals.includes(k)), key];
    });

  const go = async (place: NearbyPlace) => {
    if (!event) return;
    setBusy(place.name);
    setError('');
    try {
      const stop = await API.addStop(event.id, place);
      onStopAdded(`${place.name} added, ${formatTime(stop.start_time)} to ${formatTime(stop.end_time)}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy('');
    }
  };

  const goal = async (wanted: CommuteGoal) => {
    if (!route) return;
    setBusy(wanted);
    setError('');
    try {
      await onGoal(route, route.goal === wanted ? '' : wanted);
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy('');
    }
  };

  // The options go where there is more room: under the widget, or over it.
  const below = screenHeight - (anchor.y + anchor.height) - insets.bottom - 16;
  const above = anchor.y - insets.top - 16;
  const under = below >= above;
  const panel: ViewStyle = under
    ? { top: anchor.y + anchor.height + 14, maxHeight: Math.max(120, below - 14) }
    : { bottom: screenHeight - anchor.y + 14, maxHeight: Math.max(120, above - 14), justifyContent: 'flex-end' };

  const noTrip = 'No trip leaves from here';
  const placeRow = (place: NearbyPlace, i: number, note?: string) => (
    <Rise key={`${place.name}-${i}`} delay={40 + i * 28}>
      <Option
        icon={place.category === 'nature' ? 'pine-tree' : place.category === 'cafe' ? 'coffee-outline' : place.category === 'restaurant' ? 'silverware-fork-knife' : 'map-marker-outline'}
        label={place.name}
        note={note ?? place.kind}
        trailing={place.walk_minutes !== undefined ? `${place.walk_minutes} min walk` : undefined}
        busy={busy === place.name}
        disabled={!!busy && busy !== place.name}
        onPress={() => go(place)}
      />
    </Rise>
  );
  const back = (label: string, to: Level) => (
    <Rise>
      <Pressable
        onPress={() => {
          setError('');
          setRefine([]);
          setLevel(to);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Back from ${label}`}
        style={({ pressed }) => [styles.back, { opacity: pressed ? 0.55 : 1 }]}
      >
        <Icon source="chevron-left" size={22} color={tokens.muted} />
        <Text variant="labelLarge" style={{ color: tokens.muted }}>
          {label}
        </Text>
      </Pressable>
    </Rise>
  );

  return (
    <Portal>
      <Animated.View style={[styles.fill, veilStyle(theme.dark), { opacity: veil }]}>
        <Pressable style={styles.fill} onPress={close} accessibilityLabel="Close the options" />

        {/* The held widget, lifted out of the blur. */}
        <View style={{ position: 'absolute', top: anchor.y, left: anchor.x, width: anchor.width }} pointerEvents="none">
          {widget}
        </View>

        <View style={[styles.panel, panel, { left: anchor.x, width: anchor.width }]}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
            {level === 'root' && (
              <>
                <Rise delay={30}>
                  <Option
                    icon="pine-tree"
                    color={LineColor.rem}
                    label="Optimize for Nature"
                    note={!route ? noTrip : route.green_routes ? 'On for this trip' : 'Walks through parks'}
                    active={!!route?.green_routes}
                    disabled={!route}
                    onPress={() => {
                      if (route) onNature(route);
                    }}
                  />
                </Rise>
                {event && (
                  <Rise delay={70}>
                    <Option icon="clock-fast" color={LineColor.blueLine} label="Finished Early" note="Go somewhere with the time" onPress={() => setLevel('early')} />
                  </Rise>
                )}
                <Rise delay={110}>
                  <Option
                    icon="shoe-print"
                    color={LineColor.rtl}
                    label="Optimize for Steps"
                    note={!route ? noTrip : route.goal === 'steps' ? 'On for this trip' : 'The way with the most walking'}
                    active={route?.goal === 'steps'}
                    disabled={!route || (!!busy && busy !== 'steps')}
                    busy={busy === 'steps'}
                    onPress={() => goal('steps')}
                  />
                </Rise>
                <Rise delay={150}>
                  <Option
                    icon="leaf"
                    color={LineColor.rem}
                    label="Optimize for CO₂ Saved"
                    note={!route ? noTrip : route.goal === 'co2' ? 'On for this trip' : 'The way that emits the least'}
                    active={route?.goal === 'co2'}
                    disabled={!route || (!!busy && busy !== 'co2')}
                    busy={busy === 'co2'}
                    onPress={() => goal('co2')}
                  />
                </Rise>
              </>
            )}

            {level === 'early' && (
              <>
                {back('Finished early', 'root')}
                {CATEGORIES.map((c, i) => (
                  <Rise key={c.key} delay={30 + i * 40}>
                    <Option
                      icon={c.icon}
                      color={c.key === 'nature' ? LineColor.rem : undefined}
                      label={c.label}
                      note={located ? undefined : 'This event has no place on the map'}
                      disabled={!located}
                      onPress={() => setLevel(c.key)}
                    />
                  </Rise>
                ))}
                <Rise delay={160} style={styles.search}>
                  <Icon source="magnify" size={22} color={tokens.muted} />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Or type where you want to go"
                    placeholderTextColor={tokens.muted}
                    accessibilityLabel="Search for a place"
                    autoCorrect={false}
                    style={[styles.input, { color: tokens.post, borderBottomColor: tokens.border }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]}
                  />
                </Rise>
                {found.map((place, i) => placeRow(place, i))}
                {found.length === 0 && picks.length > 0 && (
                  <>
                    <Rise delay={200}>
                      <Text variant="labelMedium" style={[styles.heading, { color: tokens.muted }]}>
                        Your most picked
                      </Text>
                    </Rise>
                    {picks.map((place, i) => placeRow(place, i + 6, `${place.kind || 'Place'} · picked ${place.picks} time${place.picks === 1 ? '' : 's'}`))}
                  </>
                )}
              </>
            )}

            {level !== 'root' && level !== 'early' && (
              <>
                {back(CATEGORIES.find((c) => c.key === level)?.label ?? '', 'early')}
                <Rise delay={30} style={styles.words}>
                  {REFINE[level].map((word) => {
                    const on = refine.includes(word.key);
                    return (
                      <Pressable
                        key={word.key}
                        onPress={() => toggleRefine(word.key, word.group)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        accessibilityLabel={word.label}
                        style={({ pressed }) => [styles.word, { opacity: pressed ? 0.55 : 1 }]}
                      >
                        <Text variant="titleSmall" style={{ color: on ? tokens.accent : tokens.muted, fontFamily: on ? Font.bold : Font.medium }}>
                          {word.label}
                        </Text>
                        <View style={[styles.wordMark, { backgroundColor: on ? tokens.accent : 'transparent' }]} />
                      </Pressable>
                    );
                  })}
                </Rise>
                {places === null ? (
                  <View style={styles.wait}>
                    <ActivityIndicator color={tokens.accent} />
                  </View>
                ) : places.length === 0 ? (
                  <Rise>
                    <Text variant="bodyMedium" style={[styles.heading, { color: tokens.muted }]}>
                      Nothing like that nearby. Try fewer words.
                    </Text>
                  </Rise>
                ) : (
                  places.map((place, i) => placeRow(place, i))
                )}
              </>
            )}

            {!!error && (
              <Rise>
                <Text variant="bodyMedium" style={[styles.heading, { color: tokens.warn }]}>
                  {error}
                </Text>
              </Rise>
            )}
          </ScrollView>
        </View>
      </Animated.View>
    </Portal>
  );
};

// The blur is a browser feature; on a phone the veil is close to opaque instead.
const veilStyle = (dark: boolean): ViewStyle =>
  Platform.OS === 'web'
    ? ({ backgroundColor: dark ? 'rgba(13, 22, 38, 0.62)' : 'rgba(241, 245, 252, 0.7)', backdropFilter: 'blur(16px)' } as ViewStyle)
    : { backgroundColor: dark ? 'rgba(13, 22, 38, 0.94)' : 'rgba(241, 245, 252, 0.95)' };

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  panel: { position: 'absolute' },
  list: { paddingHorizontal: 6, paddingBottom: 8 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 54, paddingVertical: 6 },
  optionIcon: { width: 30, alignItems: 'center' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 40, marginLeft: -4 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 54, paddingLeft: 4 },
  input: { flex: 1, minHeight: 44, fontFamily: Font.medium, fontSize: 16, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 8 },
  heading: { paddingTop: 14, paddingBottom: 4, paddingLeft: 4 },
  words: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 18, rowGap: 2, paddingLeft: 4, paddingVertical: 6 },
  word: { minHeight: 40, justifyContent: 'center', alignItems: 'center' },
  wordMark: { width: 5, height: 5, borderRadius: 3, marginTop: 3 },
  wait: { minHeight: 80, alignItems: 'center', justifyContent: 'center' },
  tabular: { fontVariant: ['tabular-nums'] },
});
