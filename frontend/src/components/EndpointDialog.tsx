import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, Dialog, HelperText, Portal, Switch, Text, TextInput } from 'react-native-paper';
import { DayEndpoint, EndpointKind, Location } from '../types';
import { useApp } from '../store/AppContext';
import { API } from '../api/client';
import { placeIcon, useTokens } from '../theme';
import { formatDay } from '../utils/format';

interface Props {
  visible: boolean;
  which: EndpointKind;
  date: string;
  endpoint: DayEndpoint | null; // what the day currently starts from / ends at
  onDismiss: () => void;
}

// Choose where one day starts or ends: type an address or pick a saved place.
// It applies to that day only, unless "make this my home" is on, which
// changes the default for every day.
export const EndpointDialog: React.FC<Props> = ({ visible, which, date, endpoint, onDismiss }) => {
  const tokens = useTokens();
  const { collections, preferences, updatePreferences, refresh } = useApp();
  const [address, setAddress] = useState('');
  const [picked, setPicked] = useState<{ location: Location; category?: string } | null>(null);
  const [asHome, setAsHome] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const hasHome = !!preferences?.home_location;

  useEffect(() => {
    if (!visible) return;
    setAddress('');
    setPicked(null);
    setAsHome(!hasHome); // with no home yet, the first address given is most likely home
    setError('');
    // reset only when the dialog opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const savedPlaces = collections.flatMap((c) => c.places).filter((p) => p.location.latitude || p.location.longitude);
  const starts = which === 'origin';

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await action();
      onDismiss();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const save = () =>
    run(async () => {
      const text = address.trim();
      if (!picked && !text) throw new Error('Type an address or pick a saved place.');
      if (asHome) {
        if (!preferences) throw new Error('Settings are not loaded yet. Try again in a moment.');
        const location = picked?.location ?? (await API.geocode(text));
        await API.resetDayEndpoint(date, which);
        // updatePreferences re-plans the day
        await updatePreferences({
          ...preferences,
          home_location: { ...location, name: 'Home', address: picked?.location.address || text || location.address },
        });
        return;
      }
      await API.setDayEndpoint(date, which, {
        location: picked?.location ?? { name: text, address: text, latitude: 0, longitude: 0 },
        category: picked?.category,
      });
      await refresh();
    });

  const backToHome = () =>
    run(async () => {
      await API.resetDayEndpoint(date, which);
      await refresh();
    });

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title>{starts ? 'Where does this day start?' : 'Where does this day end?'}</Dialog.Title>
        <Dialog.ScrollArea style={styles.area}>
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <Text variant="bodyMedium" style={{ color: tokens.muted }}>
              {endpoint
                ? `${formatDay(date)} ${starts ? 'starts from' : 'ends at'} ${
                    endpoint.is_home ? 'home' : endpoint.location.name
                  }${endpoint.location.address && endpoint.location.address !== endpoint.location.name ? ` (${endpoint.location.address})` : ''}.`
                : 'No home address yet. Add one to plan the trip to your first event and back from your last.'}
            </Text>
            <TextInput
              mode="outlined"
              label={starts ? 'Start from (address or place name)' : 'End at (address or place name)'}
              value={address}
              onChangeText={(text) => {
                setAddress(text);
                setPicked(null);
              }}
            />
            {savedPlaces.length > 0 && (
              <View>
                <Text variant="labelMedium" style={styles.label}>
                  Or pick a saved place
                </Text>
                <View style={styles.chips}>
                  {savedPlaces.map((p) => {
                    const selected = picked?.location.name === p.name && picked.location.latitude === p.location.latitude;
                    return (
                      <Chip
                        key={p.id}
                        icon={placeIcon(p.category, p.name)}
                        selected={selected}
                        showSelectedCheck={false}
                        mode={selected ? 'flat' : 'outlined'}
                        onPress={() => {
                          setPicked({ location: { ...p.location, name: p.name, address: p.address }, category: p.category });
                          setAddress(p.name);
                        }}
                      >
                        {p.name}
                      </Chip>
                    );
                  })}
                </View>
              </View>
            )}
            <View style={styles.home}>
              <View style={{ flex: 1 }}>
                <Text variant="bodyLarge">Make this my home</Text>
                <Text variant="bodySmall" style={{ color: tokens.muted }}>
                  Every day starts and ends there, unless you choose another place for a day.
                </Text>
              </View>
              <Switch value={asHome} onValueChange={setAsHome} accessibilityLabel="Make this my home" />
            </View>
            <HelperText type="error" visible={!!error}>
              {error}
            </HelperText>
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions style={styles.actions}>
          {endpoint && !endpoint.is_home && hasHome && (
            <Button icon="home" onPress={backToHome} disabled={busy}>
              Back to home
            </Button>
          )}
          <View style={{ flex: 1 }} />
          <Button onPress={onDismiss}>Cancel</Button>
          <Button mode="contained" buttonColor={tokens.gold} textColor={tokens.onGold} onPress={save} loading={busy} disabled={busy}>
            Save
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
  label: { marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  home: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  actions: { flexWrap: 'wrap' },
});
