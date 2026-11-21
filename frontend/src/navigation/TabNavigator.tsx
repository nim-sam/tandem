import React from 'react';
import { useWindowDimensions, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Icon, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DayViewScreen } from '../screens/DayViewScreen';
import { MapScreen } from '../screens/MapScreen';
import { SavedPlacesScreen } from '../screens/SavedPlacesScreen';
import { HealthScreen } from '../screens/HealthScreen';
import { PreferencesScreen } from '../screens/PreferencesScreen';
import { Font, NAV_BAR, cardShadow, useAppTheme, useTokens } from '../theme';

const Tab = createBottomTabNavigator();

// Line icons throughout: an outline while idle, the same outline on the solid
// blue pill when selected.
const TABS = [
  { name: 'Day', component: DayViewScreen, icon: 'map-marker-path' },
  { name: 'Map', component: MapScreen, icon: 'map-outline' },
  { name: 'Places', component: SavedPlacesScreen, icon: 'bookmark-outline' },
  { name: 'Activity', component: HealthScreen, icon: 'heart-pulse' },
  { name: 'Settings', component: PreferencesScreen, icon: 'cog-outline' },
] as const;

// The navigation bar floats: a white pill inset from the screen edges with a
// soft shadow, content scrolling behind it. The selected section sits on a
// solid blue pill.
export const TabNavigator: React.FC = () => {
  const theme = useAppTheme();
  const tokens = useTokens();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // Inset from the edges on a phone; capped and centred on a wide window.
  const side = Math.max(NAV_BAR.margin, (width - 520) / 2);
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarLabelPosition: 'below-icon',
        tabBarStyle: {
          position: 'absolute',
          left: side,
          right: side,
          bottom: insets.bottom + NAV_BAR.margin,
          height: NAV_BAR.height,
          paddingTop: 8,
          paddingBottom: 8,
          paddingHorizontal: 6,
          borderRadius: NAV_BAR.height / 2,
          backgroundColor: theme.dark ? theme.colors.elevation.level4 : theme.colors.surface,
          borderTopWidth: 0,
          ...cardShadow(theme.dark),
          elevation: theme.dark ? 0 : 8,
          shadowOpacity: theme.dark ? 0 : 0.14,
          shadowRadius: 22,
          shadowOffset: { width: 0, height: 8 },
        },
      }}
    >
      {TABS.map((tab) => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.component}
          options={{
            tabBarIcon: ({ focused }) => (
              <View
                style={{
                  width: 52,
                  height: 30,
                  borderRadius: 15,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: focused ? tokens.accent : 'transparent',
                }}
              >
                <Icon source={tab.icon} size={21} color={focused ? tokens.onAccent : tokens.muted} />
              </View>
            ),
            // Rendered here because the built-in label box clips text on web.
            tabBarLabel: ({ focused }) => (
              <Text
                variant="labelMedium"
                style={{
                  color: focused ? tokens.accent : tokens.muted,
                  fontFamily: focused ? Font.semibold : Font.medium,
                  fontSize: 12,
                  lineHeight: 16,
                  marginTop: 3,
                }}
              >
                {tab.name}
              </Text>
            ),
          }}
        />
      ))}
    </Tab.Navigator>
  );
};
