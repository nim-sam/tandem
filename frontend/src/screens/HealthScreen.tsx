import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Icon, SegmentedButtons, Text } from 'react-native-paper';
import { useApp } from '../store/AppContext';
import { Screen } from '../components/Screen';
import { usePhoneSteps } from '../hooks/usePhoneSteps';
import { useAppTheme, useTokens } from '../theme';
import { HealthProvider } from '../types';
import { formatCO2, fromDateKey, todayKey } from '../utils/format';

const PHONE_STATUS = {
  checking: 'Checking the step sensor…',
  counting:
    Platform.OS === 'android'
      ? 'Counting with this phone. On Android, steps are only counted while the app is open.'
      : 'Counting with this phone.',
  unavailable:
    Platform.OS === 'web'
      ? 'A browser has no step sensor. Open the app on a phone to count steps.'
      : 'This device has no step sensor.',
  denied: 'Motion access was refused. Allow it in the phone settings to count steps.',
} as const;

export const HealthScreen: React.FC = () => {
  const theme = useAppTheme();
  const tokens = useTokens();
  const { health, week, preferences, updatePreferences, loading, error, refresh } = useApp();
  const provider: HealthProvider = preferences?.health_provider ?? 'phone';
  const phone = usePhoneSteps(provider === 'phone' && !!health, health?.total_steps_today ?? 0);

  const steps = provider === 'phone' ? phone.steps ?? health?.total_steps_today ?? 0 : health?.total_steps_today ?? 0;
  const goal = health?.step_goal || preferences?.step_goal_daily || 8000;
  const usesReported = (week?.total_reported_steps ?? 0) > 0;
  const bars = (week?.days ?? []).map((d) => ({
    date: d.date,
    value: usesReported ? d.reported_steps : d.planned_steps,
    grass: d.touched_grass,
  }));
  const max = Math.max(goal, ...bars.map((b) => b.value));
  const goalLine = Math.round((goal / max) * 112);
  const streak = week?.touch_grass_streak ?? 0;
  const simulated = provider !== 'phone';

  return (
    <Screen title="Activity" error={error} onRetry={refresh} refreshing={loading} onRefresh={refresh}>
      <View style={styles.section}>
        <View style={styles.stepsRow}>
          <Text variant="displaySmall" style={styles.figure}>
            {steps.toLocaleString()}
          </Text>
          <Text variant="bodyLarge" style={{ color: tokens.muted }}>
            steps today, of {goal.toLocaleString()}
          </Text>
        </View>
        <View
          style={[styles.track, { backgroundColor: theme.colors.surfaceVariant }]}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: goal, now: Math.min(steps, goal) }}
        >
          <View
            style={{
              width: `${Math.min(100, Math.round((steps / goal) * 100))}%`,
              height: '100%',
              backgroundColor: tokens.gold,
            }}
          />
        </View>
        <Text variant="bodyMedium" style={{ color: tokens.muted }}>
          Today's planned commutes include {(health?.commute_walking_steps ?? 0).toLocaleString()} steps of walking.
        </Text>
        <View style={styles.note}>
          <Icon source={simulated ? 'alert-outline' : 'information-outline'} size={18} color={simulated ? tokens.warn : tokens.muted} />
          <Text variant="bodySmall" style={{ flex: 1, color: simulated ? tokens.warn : tokens.muted }}>
            {simulated
              ? `Sample numbers. Connecting a ${provider === 'fitbit' ? 'Fitbit' : 'Garmin'} account is not built yet.`
              : PHONE_STATUS[phone.status]}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text variant="labelLarge">Count my steps with</Text>
        <SegmentedButtons
          value={provider}
          onValueChange={(value) =>
            preferences && updatePreferences({ ...preferences, health_provider: value as HealthProvider })
          }
          buttons={[
            { value: 'phone', label: 'Phone', icon: 'cellphone' },
            { value: 'fitbit', label: 'Fitbit', icon: 'watch' },
            { value: 'garmin', label: 'Garmin', icon: 'watch-variant' },
          ]}
        />
      </View>

      <View style={[styles.section, styles.ruled, { borderTopColor: tokens.hairline }]}>
        <Text variant="titleLarge">Last 7 days</Text>
        <View style={styles.chart}>
          <View style={[styles.goalLine, { bottom: 22 + goalLine, borderColor: tokens.muted }]} />
          {bars.map((bar) => (
            <View key={bar.date} style={styles.barCol}>
              <Text variant="labelSmall" style={[styles.barValue, { color: tokens.muted }]}>
                {bar.value >= 1000 ? `${(bar.value / 1000).toFixed(1)}k` : bar.value || ''}
              </Text>
              <View
                style={[
                  styles.bar,
                  {
                    height: Math.max(3, Math.round((bar.value / max) * 112)),
                    backgroundColor: bar.grass ? tokens.teal : theme.colors.outline,
                  },
                ]}
              />
              <Text
                variant="labelMedium"
                style={{ color: bar.date === todayKey() ? theme.colors.onSurface : tokens.muted }}
              >
                {fromDateKey(bar.date).toLocaleDateString([], { weekday: 'narrow' })}
              </Text>
            </View>
          ))}
        </View>
        <Text variant="bodySmall" style={{ color: tokens.muted }}>
          {usesReported ? 'Steps measured by your phone.' : 'Walking planned in your commutes; nothing measured yet.'} Teal
          bars are days with a green walk. The dashed line is your goal.
        </Text>
      </View>

      <View style={[styles.section, styles.ruled, { borderTopColor: tokens.hairline }]}>
        <View style={styles.statRow}>
          <Icon source="pine-tree" size={24} color={tokens.teal} />
          <View style={{ flex: 1 }}>
            <Text variant="titleMedium">
              {streak > 0 ? `${streak} day${streak === 1 ? '' : 's'} in a row with a green walk` : 'No green-walk streak yet'}
            </Text>
            <Text variant="bodyMedium" style={{ color: tokens.muted }}>
              {streak > 0 ? 'Counted from the routes planned for each day.' : 'Turn on green routes on the Day tab to start one.'}
            </Text>
          </View>
        </View>
        <View style={styles.statRow}>
          <Icon source="leaf" size={24} color={tokens.teal} />
          <View style={{ flex: 1 }}>
            <Text variant="titleMedium">{formatCO2(week?.total_co2_saved_grams ?? 0)} CO₂ avoided this week</Text>
            <Text variant="bodyMedium" style={{ color: tokens.muted }}>
              Compared with driving the same trips. An estimate from planned routes.
            </Text>
          </View>
        </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  section: { gap: 10 },
  ruled: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 20, marginTop: 4 },
  stepsRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' },
  figure: { fontSize: 56, lineHeight: 58, fontVariant: ['tabular-nums'] },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  note: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 160, marginTop: 4 },
  goalLine: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1, borderStyle: 'dashed' },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  barValue: { fontVariant: ['tabular-nums'] },
  bar: { width: '64%', borderRadius: 3 },
  statRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start', paddingVertical: 6 },
});
