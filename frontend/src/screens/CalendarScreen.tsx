import React, { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Button, FAB, IconButton, Snackbar, Text, TextInput, TouchableRipple } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { useApp } from '../store/AppContext';
import { API } from '../api/client';
import { Screen } from '../components/Screen';
import { EventDialog } from '../components/EventDialog';
import { GoogleSync } from '../components/GoogleSync';
import { useAppTheme, useTokens } from '../theme';
import { Event } from '../types';
import { addDays, formatDay, formatTime, fromDateKey, toDateKey, todayKey } from '../utils/format';

const mondayOf = (key: string): string => {
  const d = fromDateKey(key);
  return addDays(key, -((d.getDay() + 6) % 7));
};

const SOURCE_LABEL: Record<string, string> = { google: 'Google', 'google-demo': 'Demo', ics: 'Imported' };

export const CalendarScreen: React.FC = () => {
  const theme = useAppTheme();
  const tokens = useTokens();
  const navigation = useNavigation();
  const { date, setDate, refresh } = useApp();
  const [weekStart, setWeekStart] = useState(mondayOf(date));
  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [dialog, setDialog] = useState<{ open: boolean; day: string; event: Event | null }>({
    open: false,
    day: date,
    event: null,
  });
  const [showPaste, setShowPaste] = useState(false);
  const [icsText, setIcsText] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await API.getEvents(weekStart, addDays(weekStart, 6));
      setEvents(res.events);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [weekStart]);

  useEffect(() => {
    load();
  }, [load]);

  const changed = async (message?: string) => {
    if (message) setNotice(message);
    await Promise.all([load(), refresh()]);
  };

  const importText = async (text: string) => {
    setBusy(true);
    try {
      const result = await API.importICS(text);
      setIcsText('');
      setShowPaste(false);
      await changed(
        result.events_added === 0
          ? 'That file contained no events.'
          : `Imported ${result.events_added} event${result.events_added > 1 ? 's' : ''}.`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const pickFile = async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: Platform.OS === 'web' ? '.ics,text/calendar' : ['text/calendar', '*/*'],
        copyToCacheDirectory: true,
      });
      if (picked.canceled || !picked.assets?.length) return;
      const asset = picked.assets[0];
      const text = asset.file ? await asset.file.text() : await (await fetch(asset.uri)).text();
      if (!text.includes('BEGIN:VCALENDAR') && !text.includes('BEGIN:VEVENT')) {
        setError('That does not look like a calendar (.ics) file.');
        return;
      }
      await importText(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const remove = async (event: Event) => {
    try {
      await API.deleteEvent(event.id);
      await changed(`Deleted "${event.title}".`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekLabel = `${fromDateKey(weekStart).toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${fromDateKey(
    days[6]
  ).toLocaleDateString([], { month: 'short', day: 'numeric' })}`;

  return (
    <View style={styles.root}>
      <Screen
        title="Calendar"
        subtitle={weekLabel}
        error={error}
        onRetry={load}
        actions={
          <>
            <IconButton icon="chevron-left" accessibilityLabel="Previous week" onPress={() => setWeekStart(addDays(weekStart, -7))} />
            {weekStart !== mondayOf(todayKey()) && (
              <IconButton icon="calendar-today" accessibilityLabel="This week" onPress={() => setWeekStart(mondayOf(todayKey()))} />
            )}
            <IconButton icon="chevron-right" accessibilityLabel="Next week" onPress={() => setWeekStart(addDays(weekStart, 7))} />
          </>
        }
      >
        {days.map((day) => {
          const dayEvents = events.filter((e) => toDateKey(new Date(e.start_time)) === day);
          return (
            <View key={day} style={[styles.day, { borderBottomColor: tokens.hairline }]}>
              <TouchableRipple
                onPress={() => {
                  setDate(day);
                  navigation.navigate('Day' as never);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Open ${formatDay(day)} with routes`}
              >
                <View style={styles.dayHead}>
                  <Text variant="titleMedium">
                    {fromDateKey(day).toLocaleDateString([], { weekday: 'long' })}
                    <Text variant="bodyMedium" style={{ color: tokens.muted }}>
                      {'  '}
                      {fromDateKey(day).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </Text>
                  </Text>
                  {day === todayKey() && (
                    <View style={[styles.today, { borderColor: theme.colors.onSurface }]}>
                      <Text variant="labelMedium">Today</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }} />
                  {dayEvents.length > 0 && (
                    <Text variant="labelLarge" style={{ color: theme.colors.primary }}>
                      Routes
                    </Text>
                  )}
                </View>
              </TouchableRipple>
              {dayEvents.length === 0 ? (
                <Text variant="bodyMedium" style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}>
                  No events
                </Text>
              ) : (
                dayEvents.map((event) => (
                  <View key={event.id} style={styles.row}>
                    <Text variant="titleSmall" style={styles.time}>
                      {formatTime(event.start_time)}
                    </Text>
                    <TouchableRipple
                      style={{ flex: 1 }}
                      onPress={() => setDialog({ open: true, day, event })}
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${event.title}`}
                    >
                      <View>
                        <Text variant="bodyLarge">{event.title}</Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                          {[event.location.name, SOURCE_LABEL[event.external_source ?? '']].filter(Boolean).join(' · ') ||
                            'No location'}
                        </Text>
                      </View>
                    </TouchableRipple>
                    <IconButton icon="trash-can-outline" accessibilityLabel={`Delete ${event.title}`} onPress={() => remove(event)} />
                  </View>
                ))
              )}
            </View>
          );
        })}

        <Text variant="titleLarge" style={styles.heading}>
          Bring in a calendar
        </Text>
        <Button mode="contained-tonal" icon="file-upload-outline" onPress={pickFile} loading={busy} disabled={busy}>
          Import an .ics file
        </Button>
        <Button mode="text" onPress={() => setShowPaste((v) => !v)}>
          {showPaste ? 'Hide paste box' : 'Or paste .ics text'}
        </Button>
        {showPaste && (
          <>
            <TextInput
              mode="outlined"
              multiline
              numberOfLines={6}
              label="Calendar text (starts with BEGIN:VCALENDAR)"
              value={icsText}
              onChangeText={setIcsText}
            />
            <Button mode="contained" disabled={!icsText.trim() || busy} onPress={() => importText(icsText)}>
              Import
            </Button>
          </>
        )}
        <GoogleSync onSynced={(message) => changed(message)} onError={setError} />
      </Screen>

      <FAB
        icon="plus"
        accessibilityLabel="Add event"
        style={[styles.fab, { backgroundColor: tokens.gold }]}
        color={tokens.onGold}
        onPress={() => setDialog({ open: true, day: days.includes(date) ? date : weekStart, event: null })}
      />
      <EventDialog
        visible={dialog.open}
        date={dialog.day}
        event={dialog.event}
        onDismiss={() => setDialog((d) => ({ ...d, open: false }))}
        onSaved={() => changed()}
      />
      <Snackbar visible={!!notice} onDismiss={() => setNotice('')} duration={4000}>
        {notice}
      </Snackbar>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  day: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 12 },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
  today: { borderRadius: 4, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 1 },
  heading: { marginTop: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8 },
  time: { width: 52, fontVariant: ['tabular-nums'] },
  empty: { paddingVertical: 4 },
  fab: { position: 'absolute', right: 16, bottom: 16 },
});
