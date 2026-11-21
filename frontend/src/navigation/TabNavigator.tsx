import React from 'react';
import { useWindowDimensions, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Icon, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DayViewScreen } from '../screens/DayViewScreen';
import { CalendarScreen } from '../screens/CalendarScreen';
import { SavedPlacesScreen } from '../screens/SavedPlacesScreen';
import { HealthScreen } from '../screens/HealthScreen';
import { PreferencesScreen } from '../screens/PreferencesScreen';
import { NAV_BAR, useAppTheme, useTokens } from '../theme';

const Tab = createBottomTabNavigator();

const TABS = [
  { name: 'Day', component: DayViewScreen, icon: 'map-marker-path' },
  { name: 'Calendar', component: CalendarScreen, icon: 'calendar-month' },
  { name: 'Places', component: SavedPlacesScreen, icon: 'bookmark-multiple' },
  { name: 'Activity', component: HealthScreen, icon: 'shoe-print' },
  { name: 'Settings', component: PreferencesScreen, icon: 'tune-variant' },
] as const;

// Material 3 navigation bar, floating: a rounded bar inset from the screen
// edges, content scrolling behind it. The selected destination sits on a blue pill.
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
          paddingTop: 6,
          paddingBottom: 6,
          borderRadius: NAV_BAR.height / 2,
          backgroundColor: theme.colors.elevation.level3,
          borderTopWidth: 1, // the bar's own outline, all the way round
          borderWidth: 1,
          borderColor: tokens.hairline,
          borderTopColor: tokens.hairline,
          // Lifted off the content it floats over.
          elevation: 6,
          shadowColor: '#000000',
          shadowOpacity: theme.dark ? 0.45 : 0.16,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
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
                  backgroundColor: focused ? tokens.accent : 'transparent',
                }}
              >
                <Icon source={tab.icon} size={22} color={focused ? tokens.onAccent : tokens.muted} />
              </View>
            ),
            // Rendered here because the built-in label box clips text on web.
            tabBarLabel: ({ focused }) => (
              <Text
                variant="labelMedium"
                style={{ color: focused ? theme.colors.onSurface : tokens.muted, lineHeight: 16, marginTop: 2 }}
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
