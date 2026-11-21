import React from 'react';
import { useColorScheme, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import { useFonts } from 'expo-font';
import { BarlowSemiCondensed_600SemiBold } from '@expo-google-fonts/barlow-semi-condensed/600SemiBold';
import { BarlowSemiCondensed_700Bold } from '@expo-google-fonts/barlow-semi-condensed/700Bold';
import {
  NavigationContainer,
  DefaultTheme as NavLight,
  DarkTheme as NavDark,
} from '@react-navigation/native';
import { LightTheme, DarkTheme } from './src/theme';
import { AppProvider, useApp } from './src/store/AppContext';
import { TabNavigator } from './src/navigation/TabNavigator';

// Dark unless the user picked light (or "match my phone") in Settings.
const Themed: React.FC = () => {
  const { preferences } = useApp();
  const system = useColorScheme();
  const appearance = preferences?.appearance ?? 'dark';
  const dark = appearance === 'dark' || (appearance === 'system' && system !== 'light');
  const theme = dark ? DarkTheme : LightTheme;
  const base = dark ? NavDark : NavLight;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      background: theme.colors.background,
      card: theme.colors.surface,
      text: theme.colors.onSurface,
      border: theme.colors.outlineVariant,
      primary: theme.colors.primary,
    },
  };

  return (
    <PaperProvider theme={theme}>
      <NavigationContainer theme={navTheme}>
        <StatusBar style={dark ? 'light' : 'dark'} />
        <TabNavigator />
      </NavigationContainer>
    </PaperProvider>
  );
};

export default function App() {
  const [fontsLoaded, fontError] = useFonts({ BarlowSemiCondensed_600SemiBold, BarlowSemiCondensed_700Bold });
  // Hold the first frame on the ground colour until the typeface is ready,
  // so headings never flash in a fallback face. If loading fails, carry on.
  if (!fontsLoaded && !fontError) {
    return <View style={{ flex: 1, backgroundColor: DarkTheme.colors.background }} />;
  }
  return (
    <SafeAreaProvider>
      <AppProvider>
        <Themed />
      </AppProvider>
    </SafeAreaProvider>
  );
}
