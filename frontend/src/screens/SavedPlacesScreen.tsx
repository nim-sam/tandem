import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Icon, IconButton, Snackbar, Text } from 'react-native-paper';
import { useApp } from '../store/AppContext';
import { API } from '../api/client';
import { Screen } from '../components/Screen';
import { PromptDialog } from '../components/PromptDialog';
import { Card } from '../components/Card';
import { NAV_CLEARANCE, placeIcon, useTokens } from '../theme';

// The places you go to often, in one list. Each can be picked as the location
// of an event, or as where a day starts or ends.
//
// (The server still files places in collections; the app keeps them all in
// one, and shows any older collections together.)
export const SavedPlacesScreen: React.FC = () => {
  const tokens = useTokens();
  const { collections, refreshCollections } = useApp();
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState<string | null>(null);

  const places = collections.flatMap((c) => c.places.map((p) => ({ ...p, collection_id: c.id })));

  const add = async (values: Record<string, string>) => {
    const home = collections[0] ?? (await API.createCollection({ name: 'Saved places' }));
    await API.addPlace(home.id, { name: values.name, address: values.address, notes: values.notes });
    await refreshCollections();
  };

  const remove = async (collectionId: string, placeId: string, name: string) => {
    try {
      await API.removePlace(collectionId, placeId);
      await refreshCollections();
      setError(null);
      setNotice(`Removed ${name}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <View style={styles.root}>
      <Screen title="Saved places" error={error} onRetry={() => refreshCollections().then(() => setError(null))}>
        <Card frosted style={styles.card}>
          {places.length === 0 && (
            <Text variant="bodyMedium" style={[styles.empty, { color: tokens.muted }]}>
              Nothing saved yet. Add the places you go to often, to pick them in a tap when you plan a day.
            </Text>
          )}
          {places.map((place, i) => (
            <View key={place.id} style={[styles.place, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.hairline }]}>
              <Icon source={placeIcon(place.category, place.name)} size={22} color={tokens.accent} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="bodyLarge" numberOfLines={1}>
                  {place.name}
                </Text>
                <Text variant="bodySmall" style={{ color: tokens.muted }} numberOfLines={2}>
                  {place.address}
                  {place.notes ? `\n${place.notes}` : ''}
                </Text>
              </View>
              <IconButton
                icon="trash-can-outline"
                iconColor={tokens.muted}
                accessibilityLabel={`Remove ${place.name}`}
                onPress={() => remove(place.collection_id, place.id, place.name)}
              />
            </View>
          ))}
          <Button mode="text" icon="plus" style={styles.add} onPress={() => setAdding(true)}>
            Add a place
          </Button>
        </Card>
      </Screen>

      <PromptDialog
        visible={adding}
        title="Add a place"
        fields={[
          { key: 'name', label: 'Name', required: true },
          { key: 'address', label: 'Address', required: true, address: true },
          { key: 'notes', label: 'Notes (optional)' },
        ]}
        confirmLabel="Add place"
        onDismiss={() => setAdding(false)}
        onSubmit={add}
      />
      <Snackbar visible={!!notice} onDismiss={() => setNotice('')} duration={4000} wrapperStyle={{ bottom: NAV_CLEARANCE }}>
        {notice}
      </Snackbar>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  card: { gap: 2, paddingVertical: 8, paddingRight: 6 },
  empty: { paddingVertical: 10 },
  place: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60, paddingVertical: 8 },
  add: { alignSelf: 'flex-start', marginLeft: -8 },
});
