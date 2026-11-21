import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Radius, Space, cardShadow, glass, useAppTheme, useTokens } from '../theme';

interface Props {
  // white: the default foreground surface. pale: a quieter grouping inside or
  // beside white cards. deep: the one emphasis card on a screen.
  tone?: 'white' | 'pale' | 'deep';
  flush?: boolean; // no padding: the content manages its own
  frosted?: boolean; // translucent, blurring what is behind it
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

// The container everything is grouped in: a generously rounded surface with a
// soft shadow and no border.
export const Card: React.FC<Props> = ({ tone = 'white', flush, frosted, style, children }) => {
  const theme = useAppTheme();
  const tokens = useTokens();
  const fill = tone === 'deep' ? tokens.deep : tone === 'pale' ? tokens.pale : tokens.card;
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: fill },
        tone !== 'pale' && cardShadow(theme.dark),
        frosted && glass(theme.dark),
        !flush && styles.padded,
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: Radius.card },
  padded: { padding: Space.card },
});
