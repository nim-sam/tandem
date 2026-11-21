import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Icon, Text, TextInput, TouchableRipple } from 'react-native-paper';
import { API } from '../api/client';
import { Location } from '../types';
import { cardShadow, useAppTheme, useTokens } from '../theme';

interface Props {
  label: string;
  value: string;
  onChangeText: (text: string) => void; // the user typed: whatever was picked no longer holds
  onPick: (location: Location) => void; // a suggestion was chosen: it has coordinates
  resolved?: boolean; // the current text stands for a place with known coordinates
}

const MIN_CHARS = 3;
const DEBOUNCE_MS = 300;

// An address field that lists matching places while typing. Choosing one
// fixes the coordinates there and then, so an address is known to resolve
// before the form is saved. The list opens in place, under the field.
export const AddressInput: React.FC<Props> = ({ label, value, onChangeText, onPick, resolved }) => {
  const theme = useAppTheme();
  const tokens = useTokens();
  const [suggestions, setSuggestions] = useState<Location[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(''); // the text the current suggestions answer
  const [focused, setFocused] = useState(false);
  const typed = useRef(false); // only text the user typed is searched, not text set by the form
  const latest = useRef(0);

  useEffect(() => {
    const text = value.trim();
    if (!typed.current || resolved || text.length < MIN_CHARS) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    const ticket = ++latest.current;
    setSearching(true);
    const timer = setTimeout(() => {
      API.suggestPlaces(text)
        .then((res) => {
          if (ticket !== latest.current) return; // an answer for older text
          setSuggestions(res.suggestions);
          setSearched(text);
        })
        .catch(() => {
          if (ticket === latest.current) setSuggestions([]);
        })
        .finally(() => {
          if (ticket === latest.current) setSearching(false);
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value, resolved]);

  const text = value.trim();
  const noMatch = typed.current && !resolved && !searching && searched === text && text.length >= MIN_CHARS && suggestions.length === 0;
  const open = focused && !resolved && suggestions.length > 0;

  return (
    <View>
      <TextInput
        mode="outlined"
        label={label}
        value={value}
        onChangeText={(next) => {
          typed.current = true;
          onChangeText(next);
        }}
        onFocus={() => setFocused(true)}
        // Delayed so a tap on a suggestion lands before the list closes.
        onBlur={() => setTimeout(() => setFocused(false), 200)}
        autoCorrect={false}
        right={
          searching ? (
            <TextInput.Icon icon={() => <ActivityIndicator size={16} color={tokens.muted} />} />
          ) : resolved ? (
            <TextInput.Icon icon="map-marker-check-outline" color={tokens.offer} forceTextInputFocus={false} />
          ) : undefined
        }
      />

      {open && (
        <View style={[styles.list, { backgroundColor: tokens.card, borderColor: tokens.hairline }, cardShadow(theme.dark)]} accessibilityRole="list">
          {suggestions.map((s, i) => {
            const city = s.address && s.address !== s.name ? s.address.slice(s.name.length).replace(/^,\s*/, '') : '';
            return (
              <TouchableRipple
                key={`${s.address}-${i}`}
                onPress={() => {
                  typed.current = false;
                  setSuggestions([]);
                  onPick(s);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Use ${s.address || s.name}`}
                style={[styles.option, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.hairline }]}
              >
                <View style={styles.optionRow}>
                  <Icon source="map-marker-outline" size={18} color={tokens.muted} />
                  <Text variant="bodyMedium" numberOfLines={1} style={{ flexShrink: 1 }}>
                    {s.name}
                  </Text>
                  {!!city && (
                    <Text variant="bodySmall" numberOfLines={1} style={{ color: tokens.muted, flexShrink: 0 }}>
                      {city}
                    </Text>
                  )}
                </View>
              </TouchableRipple>
            );
          })}
        </View>
      )}

      {resolved ? (
        <Text variant="bodySmall" style={[styles.status, { color: tokens.offer }]}>
          Found on the map
        </Text>
      ) : noMatch ? (
        <Text variant="bodySmall" style={[styles.status, { color: tokens.warn }]}>
          No match in the Montreal region yet. Keep typing, or try a street address.
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  list: { borderWidth: 1, borderRadius: 14, marginTop: 6, overflow: 'hidden' },
  option: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  status: { marginTop: 4, marginLeft: 4 },
});
