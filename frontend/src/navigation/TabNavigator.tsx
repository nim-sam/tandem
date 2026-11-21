import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Icon, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DayViewScreen } from '../screens/DayViewScreen';
import { CalendarScreen } from '../screens/CalendarScreen';
import { SavedPlacesScreen } from '../screens/SavedPlacesScreen';
import { HealthScreen } from '../screens/HealthScreen';
import { PreferencesScreen } from '../screens/PreferencesScreen';
import { useAppTheme, useTokens } from '../theme';

const Tab = createBottomTabNavigator();

const TABS = [
  { name: 'Day', component: DayViewScreen, icon: 'map-marker-path' },
  { name: 'Calendar', component: CalendarScreen, icon: 'calendar-month' },
  { name: 'Places', component: SavedPlacesScreen, icon: 'bookmark-multiple' },
  { name: 'Activity', component: HealthScreen, icon: 'shoe-print' },
  { name: 'Settings', component: PreferencesScreen, icon: 'tune-variant' },
] as const;

// Material 3 navigation bar: the selected destination sits on a gold pill.
export const TabNavigator: React.FC = () => {
  const theme = useAppTheme();
  const tokens = useTokens();
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: tokens.hairline,
          height: 72 + insets.bottom,
          paddingTop: 8,
          paddingBottom: 8 + insets.bottom,
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
                  width: 56,
                  height: 30,
                  borderRadius: 15,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: focused ? tokens.gold : 'transparent',
                }}
              >
                <Icon source={tab.icon} size={22} color={focused ? tokens.onGold : tokens.muted} />
              </View>
            ),
            // Rendered here because the built-in label box clips text on web.
            tabBarLabel: ({ focused }) => (
              <Text
                variant="labelMedium"
                style={{ color: focused ? theme.colors.onSurface : tokens.muted, lineHeight: 16, marginTop: 4 }}
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
