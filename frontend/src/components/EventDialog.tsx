import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, Dialog, HelperText, Portal, Text, TextInput } from 'react-native-paper';
import { Event, Location } from '../types';
import { useApp } from '../store/AppContext';
import { API } from '../api/client';
import { timeOnDate, toDateKey, toHHMM } from '../utils/format';

interface Props {
  visible: boolean;
  date: string; // day for a new event
  event?: Event | null; // set when editing
  onDismiss: () => void;
  onSaved: () => void;
}

// Add or edit an event. The location is typed as an address (the server finds
// the coordinates) or picked from saved places.
export const EventDialog: React.FC<Props> = ({ visible, date, event, onDismiss, onSaved }) => {
  const { collections } = useApp();
  const [title, setTitle] = useState('');
  const [day, setDay] = useState(date);
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('10:00');
  const [place, setPlace] = useState('');
  const [picked, setPicked] = useState<Location | null>(null); // saved place with known coordinates
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setError('');
    if (event) {
      setTitle(event.title);
      setDay(toDateKey(new Date(event.start_time)));
      setStart(toHHMM(event.start_time));
      setEnd(toHHMM(event.end_time));
      setPlace(event.location.address || event.location.name || '');
      setPicked(event.location.latitude || event.location.longitude ? event.location : null);
    } else {
      setTitle('');
      setDay(date);
      setStart('09:00');
      setEnd('10:00');
      setPlace('');
      setPicked(null);
    }
  }, [visible, event, date]);

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
    const payload = { title: title.trim(), location, start_time: startISO, end_time: endISO, is_external: false };

    setSaving(true);
    try {
      const saved = event ? await API.updateEvent(event.id, payload) : await API.addEvent(payload);
      if (place.trim() && !saved.location.latitude && !saved.location.longitude) {
        // Saved, but routes cannot be planned to it.
        setError(`Saved, but "${place.trim()}" could not be found on the map, so no route will be planned. Try a street address.`);
        onSaved();
        return;
      }
      onSaved();
      onDismiss();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title>{event ? 'Edit event' : 'New event'}</Dialog.Title>
        <Dialog.ScrollArea style={styles.area}>
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <TextInput mode="outlined" label="Title" value={title} onChangeText={setTitle} />
            <TextInput mode="outlined" label="Date (YYYY-MM-DD)" value={day} onChangeText={setDay} autoCapitalize="none" />
            <View style={styles.times}>
              <TextInput mode="outlined" label="Starts (HH:MM)" value={start} onChangeText={setStart} style={styles.time} />
              <TextInput mode="outlined" label="Ends (HH:MM)" value={end} onChangeText={setEnd} style={styles.time} />
            </View>
            <TextInput
              mode="outlined"
              label="Where (address or place name)"
              value={place}
              onChangeText={(text) => {
                setPlace(text);
                setPicked(null);
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
            <HelperText type="error" visible={!!error}>
              {error}
            </HelperText>
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancel</Button>
          <Button mode="contained" onPress={save} loading={saving} disabled={saving}>
            {event ? 'Save' : 'Add event'}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  dialog: { maxWidth: 560, width: '92%', alignSelf: 'center', maxHeight: '90%' },
  area: { paddingHorizontal: 0 },
  form: { paddingHorizontal: 24, paddingVertical: 8, gap: 10 },
  times: { flexDirection: 'row', gap: 10 },
  time: { flex: 1 },
  label: { marginBottom: 6 },
  chips: { gap: 8 },
});
