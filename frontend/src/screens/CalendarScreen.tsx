import React, { useCallback, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import {
  Button,
  Dialog,
  FAB,
  IconButton,
  Portal,
  SegmentedButtons,
  Snackbar,
} from 'react-native-paper';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { useApp } from '../store/AppContext';
import { API } from '../api/client';
import { Screen } from '../components/Screen';
import { EventDialog } from '../components/EventDialog';
import { GoogleSync } from '../components/GoogleSync';
import { Card } from '../components/Card';
import { TimeGrid } from '../components/TimeGrid';
import { MonthGrid, monthRange } from '../components/MonthGrid';
import { NAV_CLEARANCE, useTokens } from '../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Event } from '../types';
import { addDays, addMonths, fromDateKey, mondayOf, startOfMonth, todayKey } from '../utils/format';

type Mode = 'week' | 'month';

const short = (key: string) => fromDateKey(key).toLocaleDateString([], { month: 'short', day: 'numeric' });

// A calendar with week and month views, for looking around. Opening a day (any
// day, past or future) goes to the Day tab, which plans and shows its routes.
export const CalendarScreen: React.FC = () => {
  const tokens = useTokens();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { date, setDate, refresh } = useApp();
  const [mode, setMode] = useState<Mode>('month');
  // The week or month being browsed. Browsing does not change the day the app
  // is on (which would plan that day's routes); opening a day does.
  const [cursor, setCursor] = useState(date);
  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [dialog, setDialog] = useState<{ open: boolean; day: string; event: Event | null; start?: string }>({
    open: false,
    day: date,
    event: null,
  });
  const [importing, setImporting] = useState(false);
  const [busy, setBusy] = useState(false);

  const today = todayKey();
  const month = monthRange(cursor);
  const from = mode === 'week' ? mondayOf(cursor) : month.from;
  const to = addDays(from, mode === 'week' ? 6 : month.weeks * 7 - 1);

  const load = useCallback(async () => {
    try {
      const res = await API.getEvents(from, to);
      setEvents(res.events);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [from, to]);

  // Also reloads when the tab is opened again: events may have changed on the Day tab.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const changed = async (message?: string) => {
    if (message) setNotice(message);
    await Promise.all([load(), refresh()]);
  };

  const openDay = (day: string) => {
    setDate(day);
    navigation.navigate('Day' as never);
  };

  const step = (direction: 1 | -1) => {
    if (mode === 'week') setCursor(addDays(cursor, 7 * direction));
    else setCursor(addMonths(cursor, direction));
  };

  const showsToday = mode === 'week' ? today >= from && today <= to : cursor.slice(0, 7) === today.slice(0, 7);

  const title =
    mode === 'week'
      ? `${short(from)} – ${short(to)}`
      : fromDateKey(cursor).toLocaleDateString([], { month: 'long', year: 'numeric' });

  const importText = async (text: string) => {
    setBusy(true);
    try {
      const result = await API.importICS(text);
      setImporting(false);
      await changed(
        result.events_added === 0
          ? 'That file contained no events.'
          : `Imported ${result.events_added} event${result.events_added > 1 ? 's' : ''}.`
      );
    } catch (e) {
      setImporting(false);
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
        setImporting(false);
        setError('That does not look like a calendar (.ics) file.');
        return;
      }
      await importText(text);
    } catch (e) {
      setImporting(false);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const newEventDay = today >= from && today <= to ? today : mode === 'month' ? startOfMonth(cursor) : from;
  const showEvent = (event: Event) => setDialog({ open: true, day: date, event });
  const addAt = (day: string, hour: number) =>
    setDialog({ open: true, day, event: null, start: `${String(hour).padStart(2, '0')}:00` });

  return (
    <View style={styles.root}>
      <Screen
        title={title}
        error={error}
        onRetry={load}
        flush
        actions={
          <>
            <IconButton icon="chevron-left" accessibilityLabel={`Previous ${mode}`} onPress={() => step(-1)} />
            {!showsToday && <IconButton icon="calendar-today" accessibilityLabel="Go to today" onPress={() => setCursor(today)} />}
            <IconButton icon="chevron-right" accessibilityLabel={`Next ${mode}`} onPress={() => step(1)} />
            <IconButton icon="calendar-import" accessibilityLabel="Bring in a calendar" onPress={() => setImporting(true)} />
          </>
        }
      >
        <View style={styles.pad}>
          <SegmentedButtons
            value={mode}
            onValueChange={(value) => setMode(value as Mode)}
            buttons={[
              { value: 'week', label: 'Week' },
              { value: 'month', label: 'Month' },
            ]}
          />
        </View>

        {mode === 'month' ? (
          <View style={styles.pad}>
            <Card flush style={styles.grid}>
              <MonthGrid month={cursor} events={events} onPressDay={openDay} />
            </Card>
          </View>
        ) : (
          <View style={styles.pad}>
            <Card flush style={styles.grid}>
              <TimeGrid
                days={Array.from({ length: 7 }, (_, i) => addDays(from, i))}
                events={events}
                onPressEvent={showEvent}
                onPressSlot={addAt}
                onPressDay={openDay}
              />
            </Card>
          </View>
        )}
      </Screen>

      <FAB
        icon="plus"
        accessibilityLabel="Add event"
        style={[styles.fab, { backgroundColor: tokens.accent, bottom: NAV_CLEARANCE + insets.bottom + 4 }]}
        color={tokens.onAccent}
        onPress={() => setDialog({ open: true, day: newEventDay, event: null })}
      />
      <EventDialog
        visible={dialog.open}
        date={dialog.day}
        event={dialog.event}
        initialStart={dialog.start}
        onDismiss={() => setDialog((d) => ({ ...d, open: false }))}
        onSaved={() => changed()}
      />

      <Portal>
        <Dialog visible={importing} onDismiss={() => setImporting(false)} style={styles.dialog}>
          <Dialog.Title>Bring in a calendar</Dialog.Title>
          <Dialog.Content style={styles.import}>
            <Button mode="contained-tonal" icon="file-upload-outline" onPress={pickFile} loading={busy} disabled={busy}>
              Import an .ics file
            </Button>
            <GoogleSync
              onSynced={(message) => {
                setImporting(false);
                changed(message);
              }}
              onError={(message) => {
                setImporting(false);
                setError(message);
              }}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setImporting(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar visible={!!notice} onDismiss={() => setNotice('')} duration={4000} wrapperStyle={{ bottom: NAV_CLEARANCE }}>
        {notice}
      </Snackbar>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  pad: { paddingHorizontal: 20 },
  grid: { paddingHorizontal: 10, paddingVertical: 12 },
  dialog: { maxWidth: 520, width: '92%', alignSelf: 'center' },
  import: { gap: 10 },
  fab: { position: 'absolute', right: 18, borderRadius: 28 },
});
