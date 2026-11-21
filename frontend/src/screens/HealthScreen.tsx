import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { useApp } from '../store/AppContext';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { usePhoneSteps } from '../hooks/usePhoneSteps';
import { useTokens } from '../theme';
import { co2Equivalent, formatCO2, fromDateKey, todayKey } from '../utils/format';

export const HealthScreen: React.FC = () => {
  const tokens = useTokens();
  const { health, week, preferences, loading, error, refresh } = useApp();
  const phone = usePhoneSteps(!!health, health?.total_steps_today ?? 0);

  const steps = phone.steps ?? health?.total_steps_today ?? 0;
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

  return (
    <Screen title="Activity" error={error} onRetry={refresh} refreshing={loading} onRefresh={refresh}>
      {/* Today's steps: the one deep card on the screen. */}
      <Card tone="deep" style={styles.section}>
        <View style={styles.stepsRow}>
          <Icon source="shoe-print" size={30} color={tokens.onDeep} />
          <Text variant="displaySmall" style={[styles.figure, { color: tokens.onDeep }]}>
            {steps.toLocaleString()}
          </Text>
          <Text variant="bodyLarge" style={{ color: tokens.onDeepMuted }}>
            steps today, of {goal.toLocaleString()}
          </Text>
        </View>
        <View
          style={[styles.track, { backgroundColor: 'rgba(255,255,255,0.18)' }]}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: goal, now: Math.min(steps, goal) }}
        >
          <View
            style={{
              width: `${Math.min(100, Math.round((steps / goal) * 100))}%`,
              height: '100%',
              borderRadius: 5,
              backgroundColor: tokens.onDeep,
            }}
          />
        </View>
        <Text variant="bodyMedium" style={{ color: tokens.onDeepMuted }}>
          Today's planned commutes include {(health?.commute_walking_steps ?? 0).toLocaleString()} steps of walking.
        </Text>
      </Card>

      <Card style={styles.section}>
        <Text variant="titleMedium">Last 7 days</Text>
        <View style={styles.chart}>
          <View style={[styles.goalLine, { bottom: 22 + goalLine, borderColor: tokens.border }]} />
          {bars.map((bar) => (
            <View key={bar.date} style={styles.barCol}>
              <Text variant="labelSmall" style={[styles.barValue, { color: tokens.muted }]}>
                {bar.value >= 1000 ? `${(bar.value / 1000).toFixed(1)}k` : bar.value || ''}
              </Text>
              <View
                style={[
                  styles.bar,
                  {
                    height: Math.max(4, Math.round((bar.value / max) * 112)),
                    backgroundColor: bar.grass ? tokens.accent : tokens.soft,
                  },
                ]}
              />
              <Text
                variant="labelMedium"
                style={{ color: bar.date === todayKey() ? tokens.accent : tokens.muted }}
              >
                {fromDateKey(bar.date).toLocaleDateString([], { weekday: 'narrow' })}
              </Text>
            </View>
          ))}
        </View>
        <Text variant="bodySmall" style={{ color: tokens.muted }}>
          {usesReported ? 'Steps measured by your phone.' : 'Walking planned in your commutes; nothing measured yet.'} Darker
          bars are days with a green walk. The dashed line is your goal.
        </Text>
      </Card>

      <Card style={styles.section}>
        <View style={styles.statRow}>
          <View style={[styles.statIcon, { backgroundColor: tokens.pale }]}>
            <Icon source="pine-tree" size={22} color={tokens.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="titleMedium">
              {streak > 0 ? `${streak} day${streak === 1 ? '' : 's'} in a row with a green walk` : 'No green-walk streak yet'}
            </Text>
            <Text variant="bodyMedium" style={{ color: tokens.muted }}>
              {streak > 0 ? 'Counted from the routes planned for each day.' : 'Hold an event on the Day tab and choose Optimize for Nature to start one.'}
            </Text>
          </View>
        </View>
        <View style={styles.statRow}>
          <View style={[styles.statIcon, { backgroundColor: tokens.pale }]}>
            <Icon source="leaf" size={22} color={tokens.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="titleMedium">{formatCO2(week?.total_co2_saved_grams ?? 0)} CO₂ avoided this week</Text>
            <Text variant="bodyMedium" style={{ color: tokens.muted }}>
              {co2Equivalent(week?.total_co2_saved_grams ?? 0)
                ? `About ${co2Equivalent(week?.total_co2_saved_grams ?? 0)}. `
                : ''}
              Compared with driving the same trips; an estimate from planned routes.
            </Text>
          </View>
        </View>
      </Card>
    </Screen>
  );
};

const styles = StyleSheet.create({
  section: { gap: 12 },
  stepsRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' },
  figure: { fontSize: 48, lineHeight: 54, fontVariant: ['tabular-nums'] },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 160, marginTop: 4 },
  goalLine: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1, borderStyle: 'dashed' },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  barValue: { fontVariant: ['tabular-nums'] },
  bar: { width: '58%', borderRadius: 6 },
  statRow: { flexDirection: 'row', gap: 14, alignItems: 'center', paddingVertical: 4 },
  statIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
