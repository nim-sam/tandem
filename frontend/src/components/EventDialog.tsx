import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, Dialog, HelperText, Icon, IconButton, Portal, Text, TextInput } from 'react-native-paper';
import { Event, Location } from '../types';
import { useApp } from '../store/AppContext';
import { API } from '../api/client';
import { useAppTheme, useTokens } from '../theme';
import { AddressInput } from './AddressInput';
import { formatTime, fromDateKey, timeOnDate, toDateKey, toHHMM } from '../utils/format';

interface Props {
  visible: boolean;
  date: string; // day for a new event
  event?: Event | null; // set to show an existing event
  initialStart?: string; // "HH:MM" for a new event (tapping an hour in the calendar)
  onDismiss: () => void;
  onSaved: () => void; // also called after a delete
}

const SOURCE_LABEL: Record<string, string> = {
  google: 'From Google Calendar',
  'google-demo': 'Demo event',
  ics: 'Imported from a calendar file',
};

const plusOneHour = (hhmm: string): string => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${String(Math.min(h + 1, 23)).padStart(2, '0')}:${h >= 23 ? '59' : String(m).padStart(2, '0')}`;
};

const Detail: React.FC<{ icon: string; children: React.ReactNode }> = ({ icon, children }) => {
  const tokens = useTokens();
  return (
    <View style={styles.detail}>
      <View style={styles.detailIcon}>
        <Icon source={icon} size={20} color={tokens.muted} />
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
};

// An event's details. An existing event opens read-only; the pencil switches
// the same dialog to editable fields. A new event opens straight in the fields.
// The location is typed as an address (the server finds the coordinates) or
// picked from saved places.
export const EventDialog: React.FC<Props> = ({ visible, date, event, initialStart, onDismiss, onSaved }) => {
  const theme = useAppTheme();
  const tokens = useTokens();
  const { collections } = useApp();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [title, setTitle] = useState('');
  const [day, setDay] = useState(date);
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('10:00');
  const [place, setPlace] = useState('');
  const [picked, setPicked] = useState<Location | null>(null); // saved place with known coordinates
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Put the event's values (or a blank form) into the fields.
  const fill = () => {
    setError('');
    setConfirmDelete(false);
    if (event) {
      setTitle(event.title);
      setDay(toDateKey(new Date(event.start_time)));
      setStart(toHHMM(event.start_time));
      setEnd(toHHMM(event.end_time));
      setPlace(event.location.address || event.location.name || '');
      setPicked(event.location.latitude || event.location.longitude ? event.location : null);
      setDescription(event.description ?? '');
    } else {
      const from = initialStart ?? '09:00';
      setTitle('');
      setDay(date);
      setStart(from);
      setEnd(plusOneHour(from));
      setPlace('');
      setPicked(null);
      setDescription('');
    }
  };

  useEffect(() => {
    if (!visible) return;
    fill();
    setEditing(!event);
    // reset only when the dialog opens or shows another event
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, event, date, initialStart]);

  const savedPlaces = collections.flatMap((c) => c.places).filter((p) => p.location.latitude || p.location.longitude);

  const save = async () => {
    if (!title.trim()) return setError('Give the event a title.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return setError('Date must look like 2026-11-21.');
    const startISO = timeOnDate(day, start);
    const endISO = timeOnDate(day, end);
    if (!startISO || !endISO) return setError('Times must look like 09:30.');
    if (new Date(endISO) <= new Date(startISO)) return setError('The end time must be after the start time.');

    // Coordinates 0,0 ask the server to look the address up.
    const location: Location = picked ?? { name: place.trim(), address: place.trim(), latitude: 0, longitude: 0 };
    const payload = {
      title: title.trim(),
      description: description.trim(),
      location,
      start_time: startISO,
      end_time: endISO,
      is_external: event?.is_external ?? false,
    };

    setSaving(true);
    try {
      const saved = event ? await API.updateEvent(event.id, payload) : await API.addEvent(payload);
      onSaved();
      if (place.trim() && !saved.location.latitude && !saved.location.longitude) {
        // Saved, but routes cannot be planned to it.
        setError(`Saved, but "${place.trim()}" could not be found on the map, so no route will be planned. Try a street address.`);
        return;
      }
      onDismiss();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!event) return;
    setSaving(true);
    try {
      await API.deleteEvent(event.id);
      onSaved();
      onDismiss();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const located = !!event && !!(event.location.latitude || event.location.longitude);
  const eventDay = event ? toDateKey(new Date(event.start_time)) : date;

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <View style={styles.head}>
          <Text variant="headlineSmall" style={{ flex: 1 }} numberOfLines={editing ? 1 : 3} accessibilityRole="header">
            {!event ? 'New event' : editing ? 'Edit event' : event.title}
          </Text>
          {event && (
            <>
              <IconButton
                icon={editing ? 'pencil-off-outline' : 'pencil-outline'}
                selected={editing}
                accessibilityLabel={editing ? 'Stop editing' : 'Edit this event'}
                onPress={() => {
                  fill(); // leaving edit mode discards unsaved changes
                  setEditing((v) => !v);
                }}
              />
              {!editing && (
                <IconButton
                  icon="trash-can-outline"
                  accessibilityLabel="Delete this event"
                  onPress={() => setConfirmDelete(true)}
                />
              )}
            </>
          )}
        </View>

        <Dialog.ScrollArea style={styles.area}>
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            {event && !editing ? (
              <>
                <Detail icon="clock-outline">
                  <Text variant="titleMedium" style={styles.tabular}>
                    {formatTime(event.start_time)}–{formatTime(event.end_time)}
                  </Text>
                  <Text variant="bodyMedium" style={{ color: tokens.muted }}>
                    {fromDateKey(eventDay).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </Text>
                </Detail>
                <Detail icon="map-marker-outline">
                  <Text variant="bodyLarge">{event.location.name || event.location.address || 'No location'}</Text>
                  {!!event.location.address && event.location.address !== event.location.name && (
                    <Text variant="bodyMedium" style={{ color: tokens.muted }}>
                      {event.location.address}
                    </Text>
                  )}
                  {!located && !!(event.location.name || event.location.address) && (
                    <Text variant="bodySmall" style={{ color: tokens.warn }}>
                      Not found on the map, so no route is planned. Edit it to a street address.
                    </Text>
                  )}
                </Detail>
                <Detail icon="text">
                  <Text variant="bodyMedium" style={{ color: event.description ? theme.colors.onSurface : tokens.muted }}>
                    {event.description || 'No description'}
                  </Text>
                </Detail>
                {!!SOURCE_LABEL[event.external_source ?? ''] && (
                  <Detail icon="calendar-sync-outline">
                    <Text variant="bodyMedium" style={{ color: tokens.muted }}>
                      {SOURCE_LABEL[event.external_source ?? '']}
                    </Text>
                  </Detail>
                )}
              </>
            ) : (
              <>
                <TextInput mode="outlined" label="Title" value={title} onChangeText={setTitle} />
                <TextInput mode="outlined" label="Date (YYYY-MM-DD)" value={day} onChangeText={setDay} autoCapitalize="none" />
                <View style={styles.times}>
                  <TextInput mode="outlined" label="Starts (HH:MM)" value={start} onChangeText={setStart} style={styles.time} />
                  <TextInput mode="outlined" label="Ends (HH:MM)" value={end} onChangeText={setEnd} style={styles.time} />
                </View>
                <AddressInput
                  label="Where (address or place name)"
                  value={place}
                  resolved={!!picked}
                  onChangeText={(text) => {
                    setPlace(text);
                    setPicked(null);
                  }}
                  onPick={(location) => {
                    setPicked(location);
                    setPlace(location.address || location.name);
                  }}
                />
                {savedPlaces.length > 0 && (
                  <View>
                    <Text variant="labelMedium" style={styles.label}>
                      Or pick a saved place
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                      {savedPlaces.map((p) => (
                        <Chip
                          key={p.id}
                          selected={picked?.name === p.name && picked?.latitude === p.location.latitude}
                          onPress={() => {
                            setPicked({ ...p.location, name: p.name, address: p.address });
                            setPlace(p.name);
                          }}
                        >
                          {p.name}
                        </Chip>
                      ))}
                    </ScrollView>
                  </View>
                )}
                <TextInput
                  mode="outlined"
                  label="Description (optional)"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={3}
                />
              </>
            )}
            <HelperText type="error" visible={!!error}>
              {error}
            </HelperText>
          </ScrollView>
        </Dialog.ScrollArea>

        <Dialog.Actions>
          {confirmDelete ? (
            <>
              <Text variant="bodyMedium" style={styles.confirm}>
                Delete this event?
              </Text>
              <Button onPress={() => setConfirmDelete(false)} disabled={saving}>
                Keep
              </Button>
              <Button textColor={tokens.warn} icon="trash-can-outline" onPress={remove} loading={saving} disabled={saving}>
                Delete
              </Button>
            </>
          ) : event && !editing ? (
            <Button onPress={onDismiss}>Close</Button>
          ) : (
            <>
              <Button onPress={onDismiss}>Cancel</Button>
              <Button
                mode="contained"
                buttonColor={tokens.gold}
                textColor={tokens.onGold}
                onPress={save}
                loading={saving}
                disabled={saving}
              >
                {event ? 'Save' : 'Add event'}
              </Button>
            </>
          )}
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  dialog: { maxWidth: 560, width: '92%', alignSelf: 'center', maxHeight: '90%' },
  head: { flexDirection: 'row', alignItems: 'flex-start', paddingLeft: 24, paddingRight: 12, paddingTop: 20, paddingBottom: 8 },
  area: { paddingHorizontal: 0 },
  form: { paddingHorizontal: 24, paddingVertical: 8, gap: 10 },
  detail: { flexDirection: 'row', gap: 12, paddingVertical: 4 },
  detailIcon: { paddingTop: 2 },
  times: { flexDirection: 'row', gap: 10 },
  time: { flex: 1 },
  label: { marginBottom: 6 },
  chips: { gap: 8 },
  confirm: { flex: 1, paddingLeft: 16 },
  tabular: { fontVariant: ['tabular-nums'] },
});
