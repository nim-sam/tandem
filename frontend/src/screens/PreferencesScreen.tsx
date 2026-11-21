import React, { useCallback, useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Button, HelperText, SegmentedButtons, Snackbar, Switch, Text, TextInput } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../store/AppContext';
import { API } from '../api/client';
import { Screen } from '../components/Screen';
import { NAV_CLEARANCE, useAppTheme, useTokens } from '../theme';
import { AddressInput } from '../components/AddressInput';
import { Card } from '../components/Card';
import { Appearance, LearnedWeights, Location, TransitMode, UserPreferences } from '../types';

const MODES: { mode: TransitMode; label: string }[] = [
  { mode: 'walk', label: 'Walking' },
  { mode: 'metro', label: 'Metro' },
  { mode: 'rem', label: 'REM' },
  { mode: 'bus', label: 'Bus' },
  { mode: 'train', label: 'Train' },
];

// What each learned weight means, phrased as what a positive value favours.
const FEATURES: Record<string, [string, string]> = {
  duration: ['Longer trips', 'Shorter trips'],
  transfers: ['More transfers', 'Fewer transfers'],
  walk: ['More walking', 'Less walking'],
  over_walk: ['Walks over your limit', 'Staying within your walking limit'],
  co2_saved: ['Lower emissions', 'Higher emissions'],
  nature: ['Greener walks', 'Less green walks'],
  bus: ['Taking the bus', 'Avoiding the bus'],
  metro: ['Taking the metro', 'Avoiding the metro'],
  rem: ['Taking the REM', 'Avoiding the REM'],
  train: ['Taking the train', 'Avoiding the train'],
  inaccessible: ['Routes with stairs', 'Step-free routes'],
  tight: ['Tight timing', 'Comfortable timing'],
};

const Row: React.FC<{ title: string; hint?: string; children: React.ReactNode }> = ({ title, hint, children }) => {
  const theme = useAppTheme();
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text variant="bodyLarge">{title}</Text>
        {!!hint && (
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {hint}
          </Text>
        )}
      </View>
      {children}
    </View>
  );
};

export const PreferencesScreen: React.FC = () => {
  const theme = useAppTheme();
  const tokens = useTokens();
  const { preferences, updatePreferences } = useApp();
  const [numbers, setNumbers] = useState({ walk: '', buffer: '', goal: '' });
  const [home, setHome] = useState('');
  const [homePicked, setHomePicked] = useState<Location | null>(null); // chosen from the suggestions
  const [homeError, setHomeError] = useState('');
  const [busy, setBusy] = useState(false);
  const [learned, setLearned] = useState<LearnedWeights | null>(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!preferences) return;
    setNumbers({
      walk: String(preferences.max_walking_minutes),
      buffer: String(preferences.departure_buffer_minutes),
      goal: String(preferences.step_goal_daily),
    });
    setHome(preferences.home_location?.address || preferences.home_location?.name || '');
  }, [preferences]);

  // Reload what the ranking has learned every time the tab is opened.
  useFocusEffect(
    useCallback(() => {
      API.getLearnedWeights().then(setLearned).catch(() => setLearned(null));
    }, [])
  );

  if (!preferences) {
    return (
      <Screen title="Settings">
        <Text variant="bodyLarge">Loading your settings…</Text>
      </Screen>
    );
  }

  const save = (patch: Partial<UserPreferences>) => updatePreferences({ ...preferences, ...patch });

  const stance = (mode: TransitMode) =>
    preferences.avoided_modes.includes(mode) ? 'avoid' : preferences.prioritized_modes.includes(mode) ? 'prefer' : 'neutral';

  const setStance = (mode: TransitMode, value: string) => {
    const prioritized = preferences.prioritized_modes.filter((m) => m !== mode);
    const avoided = preferences.avoided_modes.filter((m) => m !== mode);
    if (value === 'prefer') prioritized.push(mode);
    if (value === 'avoid') avoided.push(mode);
    save({ prioritized_modes: prioritized, avoided_modes: avoided });
  };

  const saveNumber = (key: 'walk' | 'buffer' | 'goal') => {
    const value = Math.round(Number(numbers[key]));
    if (!Number.isFinite(value) || value < 0) return;
    if (key === 'walk') save({ max_walking_minutes: value });
    if (key === 'buffer') save({ departure_buffer_minutes: value });
    if (key === 'goal') save({ step_goal_daily: value });
  };

  const saveHome = async () => {
    setHomeError('');
    if (!home.trim()) {
      await save({ home_location: null });
      setNotice('Home removed. Your day now starts and ends at your events.');
      return;
    }
    setBusy(true);
    try {
      const found = homePicked ?? (await API.geocode(home.trim()));
      await save({ home_location: { ...found, name: 'Home', address: home.trim() } });
      setNotice('Home saved. Every day now starts and ends there.');
    } catch {
      setHomeError(`Could not find "${home.trim()}" on the map. Try a full street address.`);
    } finally {
      setBusy(false);
    }
  };

  const insights = learned
    ? Object.entries(learned.learned_delta)
        .filter(([key, value]) => FEATURES[key] && Math.abs(value) >= 0.05)
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
        .slice(0, 6)
    : [];
  const strongest = Math.max(0.01, ...insights.map(([, v]) => Math.abs(v)));

  return (
    <View style={styles.root}>
      <Screen title="Settings">
        <Card style={styles.card}>
          <Text variant="titleLarge">How you like to travel</Text>
          {MODES.map(({ mode, label }) => (
            <View key={mode} style={styles.modeRow}>
              <Text variant="bodyLarge" style={styles.modeLabel}>
                {label}
              </Text>
              <SegmentedButtons
                style={{ flex: 1 }}
                value={stance(mode)}
                onValueChange={(value) => setStance(mode, value)}
                buttons={[
                  { value: 'prefer', label: 'Prefer' },
                  { value: 'neutral', label: 'OK' },
                  { value: 'avoid', label: 'Avoid' },
                ]}
              />
            </View>
          ))}
          <Row title="Step-free routes only" hint="Strongly favours stations with elevators and accessible vehicles.">
            <Switch value={preferences.require_elevator} onValueChange={(v) => save({ require_elevator: v })} />
          </Row>
          <Row title="Prefer green routes" hint="Favours walks through parks, and offers a park walk when you have time. Skipped in rain.">
            <Switch value={preferences.prefer_nature_routes} onValueChange={(v) => save({ prefer_nature_routes: v })} />
          </Row>
          <Row title="Suggest places for free time" hint="Cafés, libraries and parks that fit before you need to leave.">
            <Switch value={preferences.allow_third_place_detours} onValueChange={(v) => save({ allow_third_place_detours: v })} />
          </Row>
        </Card>

        <Card style={styles.card}>
          <Text variant="titleLarge">Timing and goals</Text>
          <View style={styles.numbers}>
            <TextInput
              mode="outlined"
              style={styles.number}
              label="Longest walk (min)"
              keyboardType="number-pad"
              value={numbers.walk}
              onChangeText={(t) => setNumbers((n) => ({ ...n, walk: t }))}
              onBlur={() => saveNumber('walk')}
            />
            <TextInput
              mode="outlined"
              style={styles.number}
              label="Arrive early by (min)"
              keyboardType="number-pad"
              value={numbers.buffer}
              onChangeText={(t) => setNumbers((n) => ({ ...n, buffer: t }))}
              onBlur={() => saveNumber('buffer')}
            />
          </View>
          <TextInput
            mode="outlined"
            label="Daily step goal"
            keyboardType="number-pad"
            value={numbers.goal}
            onChangeText={(t) => setNumbers((n) => ({ ...n, goal: t }))}
            onBlur={() => saveNumber('goal')}
          />
        </Card>

        <Card style={styles.card}>
          <Text variant="titleLarge">Home</Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            Every day starts and ends at home: the app plans the trip to your first event, tells you when to leave, and plans the trip back after your last one. Tap the home marker on a day to start or end that day somewhere else.
          </Text>
          <AddressInput
            label="Home address"
            value={home}
            resolved={!!homePicked}
            onChangeText={(text) => {
              setHome(text);
              setHomePicked(null);
            }}
            onPick={(location) => {
              setHomePicked(location);
              setHome(location.address || location.name);
            }}
          />
          <HelperText type="error" visible={!!homeError}>
            {homeError}
          </HelperText>
          <Button
            mode="contained"
            buttonColor={tokens.accent}
            textColor={tokens.onAccent}
            onPress={saveHome}
            loading={busy}
            disabled={busy || !home.trim()}
          >
            Save home
          </Button>
          {!!preferences.home_location && (
            <Button
              mode="text"
              textColor={theme.colors.onSurface}
              onPress={() => {
                setHome('');
                save({ home_location: null }).then(() => setNotice('Home removed. Your day now starts and ends at your events.'));
              }}
            >
              Remove home
            </Button>
          )}
        </Card>

        <Card style={styles.card}>
          <Text variant="titleLarge">What the app has learned about you</Text>
          {!learned || !learned.ml_agent_online ? (
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              The learning service is not running, so routes are ranked from the settings above only.
            </Text>
          ) : learned.feedback_count === 0 ? (
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              Nothing yet. When you pick a different route under "other options", the app learns what you prefer and
              ranks future routes accordingly.
            </Text>
          ) : (
            <>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                From {learned.feedback_count} route choice{learned.feedback_count > 1 ? 's' : ''}, on top of your
                settings, you seem to favour:
              </Text>
              {insights.length === 0 && <Text variant="bodyMedium">No clear pattern yet.</Text>}
              {insights.map(([key, value]) => (
                <View key={key} style={styles.insight}>
                  <Text variant="bodyMedium" style={{ flex: 1 }}>
                    {FEATURES[key][value > 0 ? 0 : 1]}
                  </Text>
                  <View style={[styles.track, { backgroundColor: theme.colors.surfaceVariant }]}>
                    <View
                      style={{
                        width: `${Math.round((Math.abs(value) / strongest) * 100)}%`,
                        backgroundColor: tokens.accent,
                        height: '100%',
                        borderRadius: 4,
                      }}
                    />
                  </View>
                </View>
              ))}
              <Button
                mode="text"
                style={{ alignSelf: 'flex-start', marginLeft: -8 }}
                onPress={() =>
                  API.resetLearnedWeights()
                    .then(() => API.getLearnedWeights())
                    .then((w) => {
                      setLearned(w);
                      setNotice('Forgotten. Routes are ranked from your settings again.');
                    })
                    .catch(() => setNotice('Could not reach the learning service.'))
                }
              >
                Forget what was learned
              </Button>
            </>
          )}
        </Card>

        <Card style={styles.card}>
          <Text variant="titleLarge">Appearance</Text>
          <SegmentedButtons
            value={preferences.appearance ?? 'light'}
            onValueChange={(value) => save({ appearance: value as Appearance })}
            buttons={[
              { value: 'dark', label: 'Dark', icon: 'weather-night' },
              { value: 'light', label: 'Light', icon: 'white-balance-sunny' },
              { value: 'system', label: 'Auto', icon: 'cellphone' },
            ]}
          />
          <Text variant="bodySmall" style={{ color: tokens.muted }}>
            Light is easier to read in direct sunlight. Auto follows your phone's setting.
          </Text>
        </Card>

        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          Transit data from{' '}
          <Text variant="bodySmall" style={{ color: theme.colors.primary }} onPress={() => Linking.openURL('https://transitous.org/sources/')}>
            Transitous sources
          </Text>
          . Maps and places ©{' '}
          <Text variant="bodySmall" style={{ color: theme.colors.primary }} onPress={() => Linking.openURL('https://www.openstreetmap.org/copyright')}>
            OpenStreetMap contributors
          </Text>
          . Weather from Open-Meteo.
        </Text>
      </Screen>
      <Snackbar visible={!!notice} onDismiss={() => setNotice('')} duration={4000} wrapperStyle={{ bottom: NAV_CLEARANCE }}>
        {notice}
      </Snackbar>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  card: { gap: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modeLabel: { width: 96 },
  numbers: { flexDirection: 'row', gap: 12 },
  number: { flex: 1 },
  insight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  track: { width: 96, height: 8, borderRadius: 4, overflow: 'hidden' },
});
