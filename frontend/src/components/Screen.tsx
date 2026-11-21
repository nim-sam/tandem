import React, { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme, useTokens } from '../theme';

interface Props {
  title: string;
  subtitle?: string; // sits beside the title, not above it
  actions?: ReactNode; // IconButton elements
  error?: string | null;
  onRetry?: () => void;
  refreshing?: boolean;
  onRefresh?: () => void;
  flush?: boolean; // content manages its own horizontal padding (the trail)
  children: ReactNode;
}

// Shared page frame: top bar on the ground colour, an inline error strip, scrolling content.
export const Screen: React.FC<Props> = ({ title, subtitle, actions, error, onRetry, refreshing, onRefresh, flush, children }) => {
  const theme = useAppTheme();
  const tokens = useTokens();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.bar, { paddingTop: insets.top + 12, borderBottomColor: tokens.hairline }]}>
        <View style={styles.titles} accessibilityRole="header">
          <Text variant="headlineMedium">{title}</Text>
          {!!subtitle && (
            <Text variant="bodyMedium" style={{ color: tokens.muted }} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
        <View style={styles.actions}>{actions}</View>
      </View>

      {!!error && (
        <View style={[styles.error, { backgroundColor: theme.colors.errorContainer }]} accessibilityRole="alert">
          <Icon source="alert-circle-outline" size={20} color={theme.colors.onErrorContainer} />
          <Text variant="bodyMedium" style={{ flex: 1, color: theme.colors.onErrorContainer }}>
            {error}
          </Text>
          {onRetry && (
            <Button compact textColor={theme.colors.onErrorContainer} onPress={onRetry}>
              Retry
            </Button>
          )}
        </View>
      )}

      <ScrollView
        contentContainerStyle={[styles.content, flush && styles.flush]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={tokens.gold} colors={[tokens.gold]} />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingLeft: 20,
    paddingRight: 8,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 64,
  },
  titles: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 10, paddingBottom: 4 },
  actions: { flexDirection: 'row', alignItems: 'center' },
  error: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 10 },
  content: { padding: 20, paddingBottom: 96, gap: 16, maxWidth: 720, width: '100%', alignSelf: 'center' },
  flush: { paddingHorizontal: 0 },
});
