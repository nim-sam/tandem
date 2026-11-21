import { MD3LightTheme, MD3DarkTheme, MD3Theme, configureFonts, useTheme } from 'react-native-paper';
import { TransitMode } from '../types';

// "Sentier": the day is one trail on a neutral ground.
// The scheme is minimal: neutral greys carry the screen and one hue, blue,
// does every accent job in two shades.
//   blue (primary)        where you are and what to commit: the selected tab,
//                         today, the add button, a dialog's one committing button
//   pale blue (secondary) offers and good news (free time, on time, found on
//                         the map); its container is the selected state of chips
//   vermilion (error)     warnings only (stairs, late, does not fit); the one
//                         colour outside the blues, because a warning must not
//                         look like an accent
//   line colours          each transit line's own colour, on pills and the trail
// These are Material 3 colour roles, so every react-native-paper component
// picks them up without per-component styling.

const DISPLAY = 'BarlowSemiCondensed_700Bold';
const TITLE = 'BarlowSemiCondensed_600SemiBold';

// Times and headings are set in a sign-style condensed face; body text and
// controls stay in the platform face. Each weight is its own font file, so
// fontWeight stays '400' here and must not be overridden on these variants.
const fonts = configureFonts({
  config: {
    displaySmall: { fontFamily: DISPLAY, fontWeight: '400', letterSpacing: 0 },
    headlineLarge: { fontFamily: DISPLAY, fontWeight: '400', letterSpacing: 0 },
    headlineMedium: { fontFamily: DISPLAY, fontWeight: '400', letterSpacing: 0 },
    headlineSmall: { fontFamily: DISPLAY, fontWeight: '400', letterSpacing: 0 },
    titleLarge: { fontFamily: TITLE, fontWeight: '400', letterSpacing: 0 },
    titleMedium: { fontFamily: TITLE, fontWeight: '400', fontSize: 18, lineHeight: 24, letterSpacing: 0 },
    titleSmall: { fontFamily: TITLE, fontWeight: '400', fontSize: 16, lineHeight: 22, letterSpacing: 0 },
  },
});

// Contrast is deliberately moderate: soft grey ink on mid charcoal, and blues
// that are clear without being loud. Body text clears WCAG AA (4.5:1) in both schemes.
export const DarkTheme: MD3Theme = {
  ...MD3DarkTheme,
  fonts,
  roundness: 2,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#8FB8F2',
    onPrimary: '#0F2542',
    primaryContainer: '#22395A',
    onPrimaryContainer: '#D4E3F9',
    secondary: '#A9C4E6',
    onSecondary: '#17293F',
    secondaryContainer: '#25364D',
    onSecondaryContainer: '#CEDDF2',
    tertiary: '#DE9584',
    onTertiary: '#3B1810',
    tertiaryContainer: '#4E2A23',
    onTertiaryContainer: '#EFCFC7',
    error: '#DE9584',
    onError: '#3B1810',
    errorContainer: '#4E2A23',
    onErrorContainer: '#EFCFC7',
    background: '#1B1B1B',
    onBackground: '#D2D2D2',
    surface: '#222222',
    onSurface: '#D2D2D2',
    surfaceVariant: '#2C2C2C',
    onSurfaceVariant: '#A0A0A0',
    outline: '#666666',
    outlineVariant: '#343434',
    inverseSurface: '#D2D2D2',
    inverseOnSurface: '#222222',
    inversePrimary: '#2D62B5',
    surfaceDisabled: 'rgba(210,210,210,0.12)',
    onSurfaceDisabled: 'rgba(210,210,210,0.38)',
    backdrop: 'rgba(0,0,0,0.5)',
    elevation: {
      level0: 'transparent',
      level1: '#222222',
      level2: '#262626',
      level3: '#2C2C2C',
      level4: '#303030',
      level5: '#343434',
    },
  },
};

export const LightTheme: MD3Theme = {
  ...MD3LightTheme,
  fonts,
  roundness: 2,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#2D62B5',
    onPrimary: '#FFFFFF',
    primaryContainer: '#D5E3F8',
    onPrimaryContainer: '#12305C',
    secondary: '#3A669C',
    onSecondary: '#FFFFFF',
    secondaryContainer: '#DAE6F5',
    onSecondaryContainer: '#1B3558',
    tertiary: '#A9503B',
    onTertiary: '#F8F8F8',
    tertiaryContainer: '#F3DAD3',
    onTertiaryContainer: '#4A1F15',
    error: '#A9503B',
    onError: '#F8F8F8',
    errorContainer: '#F3DAD3',
    onErrorContainer: '#4A1F15',
    background: '#EFEFEF',
    onBackground: '#2E2E2E',
    surface: '#F8F8F8',
    onSurface: '#2E2E2E',
    surfaceVariant: '#E4E4E4',
    onSurfaceVariant: '#626262',
    outline: '#949494',
    outlineVariant: '#D9D9D9',
    inverseSurface: '#2C2C2C',
    inverseOnSurface: '#E8E8E8',
    inversePrimary: '#8FB8F2',
    elevation: {
      level0: 'transparent',
      level1: '#F8F8F8',
      level2: '#F4F4F4',
      level3: '#EDEDED',
      level4: '#E9E9E9',
      level5: '#E6E6E6',
    },
  },
};

export const useAppTheme = () => useTheme<MD3Theme>();

// Colours by job, for the places Material's role names do not say enough.
export const useTokens = () => {
  const theme = useAppTheme();
  return {
    accent: theme.colors.primary, // the flat blue field: selected tab, today, primary action
    onAccent: theme.colors.onPrimary,
    offer: theme.colors.secondary, // offers and good news, as text and icons
    warn: theme.colors.error,
    rail: theme.dark ? '#3E3E3E' : '#CFCFCF', // the trail line
    post: theme.colors.onSurface, // event markers
    border: theme.colors.outline, // event blocks, endpoint markers
    hairline: theme.colors.outlineVariant,
    muted: theme.colors.onSurfaceVariant,
  };
};

// The navigation bar floats over the content. Anything pinned to the bottom of
// a screen (the add button, snackbars, the last row of a list) keeps this much
// clear, plus the system's bottom inset.
export const NAV_BAR = { height: 64, margin: 12 };
export const NAV_CLEARANCE = NAV_BAR.height + NAV_BAR.margin * 2;

// Fallback colours per mode, used when the agency does not publish a line colour.
export const TransitModeColors: Record<TransitMode, string> = {
  walk: '#8A8A8A',
  bus: '#2E9BE0',
  metro: '#EF8122',
  rem: '#8BC53F',
  bike: '#B07CE8',
  train: '#C98F5A',
};

const luminance = (hex: string): number => {
  const n = parseInt(hex.replace('#', ''), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
};

const mix = (hex: string, target: number, amount: number): string => {
  const n = parseInt(hex.replace('#', ''), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (target - v) * amount));
  return `#${ch.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};

// A line's own colour for its blaze. Agency colours that would vanish against
// the ground (navy on charcoal, yellow on white) are pulled toward the ink.
export const lineColor = (mode: TransitMode, routeColor: string | undefined, dark: boolean): string => {
  const valid = routeColor && /^[0-9a-fA-F]{6}$/.test(routeColor);
  let color = mode !== 'walk' && valid ? `#${routeColor}` : TransitModeColors[mode] ?? '#8A8A8A';
  const l = luminance(color);
  if (dark && l < 0.12) color = mix(color, 255, 0.45);
  if (!dark && l > 0.7) color = mix(color, 0, 0.35);
  return color;
};

// Black or white, whichever reads better on the given fill.
export const inkOn = (fill: string): string => (luminance(fill) > 0.3 ? '#161616' : '#F4F4F4');

export const modeIcon = (mode: TransitMode): string =>
  ({ walk: 'walk', metro: 'subway-variant', rem: 'train', bus: 'bus', bike: 'bike', train: 'train-variant' })[mode] ??
  'navigation';

// The icon for a place, guessed from its saved category and its name.
const PLACE_ICONS: [RegExp, string][] = [
  [/\bhome\b|maison/, 'home'],
  [/work|office|bureau/, 'briefcase'],
  [/librar|biblioth/, 'book-open-variant'],
  [/school|[ée]cole|universit|college|campus|study|class/, 'school'],
  [/caf[eé]|coffee|third_place/, 'coffee'],
  [/park|parc|garden|jardin|trail/, 'pine-tree'],
  [/gym|sport|fitness|pool|piscine|arena/, 'dumbbell'],
  [/hotel|hôtel|hostel|airbnb/, 'bed'],
  [/station|gare|airport|a[ée]roport|terminus/, 'train'],
  [/restaurant|resto|\bbar\b|\bpub\b/, 'silverware-fork-knife'],
  [/friend|\bami|parent|family|famille/, 'account-multiple'],
];

export const placeIcon = (category: string | undefined, name: string): string => {
  const text = `${category ?? ''} ${name}`.toLowerCase();
  return PLACE_ICONS.find(([pattern]) => pattern.test(text))?.[1] ?? 'map-marker';
};

// The marker for where a day starts or ends: a house for home, otherwise the
// icon that suits the place (never a house, so "not home today" is visible).
export const endpointIcon = (endpoint: { is_home: boolean; category?: string; location: { name: string } }): string => {
  if (endpoint.is_home) return 'home';
  const icon = placeIcon(endpoint.category, endpoint.location.name);
  return icon === 'home' ? 'map-marker' : icon;
};
