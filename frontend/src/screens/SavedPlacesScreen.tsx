import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, IconButton, Menu, Snackbar, Text } from 'react-native-paper';
import { useApp } from '../store/AppContext';
import { API } from '../api/client';
import { Screen } from '../components/Screen';
import { PromptDialog, PromptField } from '../components/PromptDialog';
import { useAppTheme, useTokens } from '../theme';
import { Collection, SavedPlace } from '../types';

interface Prompt {
  title: string;
  confirm: string;
  fields: PromptField[];
  run: (values: Record<string, string>) => Promise<void>;
}

export const SavedPlacesScreen: React.FC = () => {
  const theme = useAppTheme();
  const tokens = useTokens();
  const { collections, refreshCollections, preferences, updatePreferences } = useApp();
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [menu, setMenu] = useState<string | null>(null); // id of the place or collection whose menu is open
  const [notice, setNotice] = useState('');
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<unknown>, done?: string) => {
    setMenu(null);
    try {
      await action();
      await refreshCollections();
      setError(null);
      if (done) setNotice(done);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const newCollection = () =>
    setPrompt({
      title: 'New collection',
      confirm: 'Create',
      fields: [
        { key: 'name', label: 'Name', required: true },
        { key: 'description', label: 'Description (optional)' },
      ],
      run: async (v) => {
        await API.createCollection({ name: v.name, description: v.description });
        await refreshCollections();
      },
    });

  const renameCollection = (col: Collection) =>
    setPrompt({
      title: 'Rename collection',
      confirm: 'Save',
      fields: [
        { key: 'name', label: 'Name', initial: col.name, required: true },
        { key: 'description', label: 'Description (optional)', initial: col.description ?? '' },
      ],
      run: async (v) => {
        await API.updateCollection(col.id, { name: v.name, description: v.description });
        await refreshCollections();
      },
    });

  const addPlace = (col: Collection) =>
    setPrompt({
      title: `Add a place to ${col.name}`,
      confirm: 'Add place',
      fields: [
        { key: 'name', label: 'Name', required: true },
        { key: 'address', label: 'Address', required: true },
        { key: 'notes', label: 'Notes (optional)' },
      ],
      run: async (v) => {
        await API.addPlace(col.id, { name: v.name, address: v.address, notes: v.notes });
        await refreshCollections();
      },
    });

  const setHome = (place: SavedPlace) =>
    run(async () => {
      if (!preferences) return;
      if (!place.location.latitude && !place.location.longitude) {
        throw new Error(`"${place.name}" has no map position, so it cannot be used as home.`);
      }
      await updatePreferences({
        ...preferences,
        home_location: { ...place.location, name: place.name, address: place.address },
      });
    }, `${place.name} is now where your day starts.`);

  const isHome = (place: SavedPlace) =>
    !!preferences?.home_location &&
    preferences.home_location.latitude === place.location.latitude &&
    preferences.home_location.longitude === place.location.longitude;

  return (
    <View style={styles.root}>
      <Screen title="Saved places" error={error} onRetry={() => run(async () => undefined)}>
        {collections.length === 0 && (
          <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
            No collections yet. Create one to start saving places you go to often.
          </Text>
        )}

        {collections.map((col) => (
          <View key={col.id} style={[styles.card, { borderBottomColor: tokens.hairline }]}>
            <View style={styles.head}>
              <View style={{ flex: 1 }}>
                <Text variant="titleLarge">{col.name}</Text>
                {!!col.description && (
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {col.description}
                  </Text>
                )}
              </View>
              <Menu
                visible={menu === col.id}
                onDismiss={() => setMenu(null)}
                anchor={
                  <IconButton icon="dots-vertical" accessibilityLabel={`Options for ${col.name}`} onPress={() => setMenu(col.id)} />
                }
              >
                <Menu.Item
                  leadingIcon="pencil-outline"
                  title="Rename"
                  onPress={() => {
                    setMenu(null);
                    renameCollection(col);
                  }}
                />
                <Menu.Item
                  leadingIcon="trash-can-outline"
                  title={col.places.length ? `Delete with ${col.places.length} places` : 'Delete'}
                  onPress={() => run(() => API.deleteCollection(col.id), `Deleted ${col.name}.`)}
                />
              </Menu>
            </View>

            {col.places.length === 0 && (
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                Nothing saved here yet.
              </Text>
            )}
            {col.places.map((place, i) => (
              <View key={place.id} style={[i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.hairline }]}>
                <View style={styles.place}>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyLarge">{place.name}</Text>
                    {isHome(place) && (
                      <Text variant="labelMedium" style={{ color: tokens.teal }}>
                        Your day starts here
                      </Text>
                    )}
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {place.address}
                      {place.notes ? `\n${place.notes}` : ''}
                    </Text>
                  </View>
                  <Menu
                    visible={menu === place.id}
                    onDismiss={() => setMenu(null)}
                    anchor={
                      <IconButton
                        icon="dots-vertical"
                        accessibilityLabel={`Options for ${place.name}`}
                        onPress={() => setMenu(place.id)}
                      />
                    }
                  >
                    <Menu.Item leadingIcon="home-outline" title="Start my day from here" onPress={() => setHome(place)} />
                    {collections
                      .filter((c) => c.id !== col.id)
                      .map((target) => (
                        <Menu.Item
                          key={target.id}
                          leadingIcon="folder-move-outline"
                          title={`Move to ${target.name}`}
                          onPress={() => run(() => API.movePlace(col.id, place.id, target.id), `Moved to ${target.name}.`)}
                        />
                      ))}
                    <Menu.Item
                      leadingIcon="trash-can-outline"
                      title="Delete"
                      onPress={() => run(() => API.removePlace(col.id, place.id), `Deleted ${place.name}.`)}
                    />
                  </Menu>
                </View>
              </View>
            ))}
            <Button mode="text" icon="plus" style={styles.add} onPress={() => addPlace(col)}>
              Add a place
            </Button>
          </View>
        ))}

        <Button mode="contained" buttonColor={tokens.gold} textColor={tokens.onGold} icon="folder-plus-outline" onPress={newCollection}>
          New collection
        </Button>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          Saved places can be picked as the location when you add an event.
        </Text>
      </Screen>

      <PromptDialog
        visible={!!prompt}
        title={prompt?.title ?? ''}
        fields={prompt?.fields ?? []}
        confirmLabel={prompt?.confirm ?? 'Save'}
        onDismiss={() => setPrompt(null)}
        onSubmit={(values) => prompt?.run(values) ?? Promise.resolve()}
      />
      <Snackbar visible={!!notice} onDismiss={() => setNotice('')} duration={4000}>
        {notice}
      </Snackbar>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  card: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 8, gap: 4 },
  head: { flexDirection: 'row', alignItems: 'center' },
  place: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingVertical: 8 },
  add: { alignSelf: 'flex-start', marginLeft: -8 },
});
