import { Platform, ViewStyle } from 'react-native';
import { MD3LightTheme, MD3DarkTheme, MD3Theme, configureFonts, useTheme } from 'react-native-paper';
import { TransitMode } from '../types';

// A calm, card-based interface in one hue. Blue is the only accent: every
// highlight, active state, chart and control is a shade, tint or opacity of
// the same blue, and depth comes from tone (ice ground, white cards, pale
// selected states, deep emphasis) plus one soft shadow.
//
// Two colours sit outside the blues, each for a reason that is not decoration:
//   a muted red     warnings and errors only, always with an icon or words
//   line colours    a transit line's own colour on its pill and its stretch of
//                   the route, because riders know lines by colour
//
// Everything is expressed as Material 3 colour roles, so react-native-paper's
// components pick the scheme up without per-component styling.

export const Blue = {
  deep: '#163866', // strong emphasis: the summary card, dark sections
  primary: '#234F91', // primary buttons, active states, important icons
  medium: '#5279B8', // secondary fills, charts, supporting elements
  soft: '#A9BDE0', // progress tracks, card accents, the trail's rail
  pale: '#DFE8F7', // subtle card backgrounds, selected states
  ice: '#F1F5FC', // the ground
  white: '#FFFFFF', // cards and foreground surfaces
};

// One typeface, Figtree, in four weights. Each weight is its own font file, so
// fontWeight stays '400' here and must not be set on text: pick the variant.
export const Font = {
  regular: 'Figtree_400Regular',
  medium: 'Figtree_500Medium',
  semibold: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
};

const face = (fontFamily: string, fontSize: number, lineHeight: number) => ({
  fontFamily,
  fontWeight: '400' as const,
  fontSize,
  lineHeight,
  letterSpacing: 0,
});

const fonts = configureFonts({
  config: {
    displayLarge: face(Font.bold, 48, 54),
    displayMedium: face(Font.bold, 40, 46),
    displaySmall: face(Font.bold, 34, 40),
    headlineLarge: face(Font.bold, 30, 36),
    headlineMedium: face(Font.bold, 26, 32), // page titles
    headlineSmall: face(Font.bold, 22, 28), // dialog titles
    titleLarge: face(Font.semibold, 20, 26), // section headings
    titleMedium: face(Font.semibold, 17, 24), // card titles
    titleSmall: face(Font.semibold, 15, 20), // stop names, times
    bodyLarge: face(Font.regular, 16, 24),
    bodyMedium: face(Font.regular, 15, 21),
    bodySmall: face(Font.regular, 13, 18),
    labelLarge: face(Font.semibold, 15, 20), // buttons
    labelMedium: face(Font.medium, 13, 18),
    labelSmall: face(Font.medium, 12, 16),
    default: face(Font.regular, 15, 21),
  },
});

export const LightTheme: MD3Theme = {
  ...MD3LightTheme,
  fonts,
  roundness: 4, // Material's scale: 4dp fields x this, pill buttons, 28dp dialogs
  colors: {
    ...MD3LightTheme.colors,
    primary: Blue.primary,
    onPrimary: Blue.white,
    primaryContainer: Blue.pale,
    onPrimaryContainer: Blue.deep,
    secondary: '#456DAD', // medium blue, deepened a step so it also reads as text
    onSecondary: Blue.white,
    secondaryContainer: Blue.pale,
    onSecondaryContainer: Blue.deep,
    tertiary: Blue.medium,
    onTertiary: Blue.white,
    tertiaryContainer: Blue.pale,
    onTertiaryContainer: Blue.deep,
    error: '#B4483F',
    onError: Blue.white,
    errorContainer: '#F8E4E1',
    onErrorContainer: '#5A1B15',
    background: Blue.ice,
    onBackground: '#14243D',
    surface: Blue.white,
    onSurface: '#14243D', // ink: a near-black blue
    surfaceVariant: Blue.pale,
    onSurfaceVariant: '#5B6B84', // secondary text: a desaturated blue-grey
    outline: '#A7B4C9',
    outlineVariant: '#E1E7F1',
    inverseSurface: Blue.deep,
    inverseOnSurface: Blue.ice,
    inversePrimary: Blue.soft,
    surfaceDisabled: 'rgba(20,36,61,0.10)',
    onSurfaceDisabled: 'rgba(20,36,61,0.38)',
    backdrop: 'rgba(15,32,60,0.42)',
    elevation: {
      level0: 'transparent',
      level1: Blue.white,
      level2: Blue.white,
      level3: Blue.white,
      level4: Blue.white,
      level5: Blue.white,
    },
  },
};

// The same family at night: navy grounds, the soft and pale blues as accents.
export const DarkTheme: MD3Theme = {
  ...MD3DarkTheme,
  fonts,
  roundness: 4,
  colors: {
    ...MD3DarkTheme.colors,
    primary: Blue.soft,
    onPrimary: '#10294D',
    primaryContainer: '#223F70',
    onPrimaryContainer: Blue.pale,
    secondary: '#8FA9D6',
    onSecondary: '#10294D',
    secondaryContainer: '#223F70',
    onSecondaryContainer: Blue.pale,
    tertiary: '#8FA9D6',
    onTertiary: '#10294D',
    tertiaryContainer: '#223F70',
    onTertiaryContainer: Blue.pale,
    error: '#E79C94',
    onError: '#4A1712',
    errorContainer: '#4D2824',
    onErrorContainer: '#F6D5D1',
    background: '#0D1626',
    onBackground: '#E4EAF5',
    surface: '#162338',
    onSurface: '#E4EAF5',
    surfaceVariant: '#20304D',
    onSurfaceVariant: '#9DABC4',
    outline: '#4A5C7C',
    outlineVariant: '#24344F',
    inverseSurface: Blue.pale,
    inverseOnSurface: Blue.deep,
    inversePrimary: Blue.primary,
    surfaceDisabled: 'rgba(228,234,245,0.10)',
    onSurfaceDisabled: 'rgba(228,234,245,0.38)',
    backdrop: 'rgba(4,9,18,0.6)',
    elevation: {
      level0: 'transparent',
      level1: '#162338',
      level2: '#1A2941',
      level3: '#1E2E4A',
      level4: '#213252',
      level5: '#243759',
    },
  },
};

export const useAppTheme = () => useTheme<MD3Theme>();

// Colours by job, for the places Material's role names do not say enough.
export const useTokens = () => {
  const theme = useAppTheme();
  const dark = theme.dark;
  return {
    accent: theme.colors.primary, // the solid blue: active tab, today, primary action
    onAccent: theme.colors.onPrimary,
    offer: theme.colors.secondary, // offers and good news, as text and icons
    green: dark ? '#7BC88A' : '#2E7D32', // the one non-blue: the pine tree on a walk through a park
    warn: theme.colors.error,
    deep: dark ? '#223F70' : Blue.deep, // the emphasis card
    onDeep: dark ? Blue.pale : Blue.white,
    onDeepMuted: dark ? '#A9BDE0' : '#C3D2EC',
    pale: theme.colors.surfaceVariant, // selected states, quiet fills
    onPale: theme.colors.onPrimaryContainer,
    soft: dark ? '#3A5384' : Blue.soft, // tracks and the unselected series of a chart
    rail: dark ? '#35476A' : '#C5D2E8', // the trail line
    post: theme.colors.onSurface, // primary text and markers
    border: theme.colors.outline,
    hairline: theme.colors.outlineVariant,
    muted: theme.colors.onSurfaceVariant,
    card: theme.colors.surface,
  };
};

// Shape. One radius per kind of thing, used everywhere.
export const Radius = { card: 22, block: 16, control: 14, pill: 999, tag: 8 };

// Space. Screens use a 20dp gutter; cards 18dp of padding; 14dp between cards.
export const Space = { gutter: 20, card: 18, gap: 14 };

// The one shadow: soft, low and tinted blue, under cards and floating controls.
// On the navy theme depth is tonal instead, so there is none.
export const cardShadow = (dark: boolean): ViewStyle =>
  dark
    ? {}
    : Platform.select<ViewStyle>({
        android: { elevation: 2, shadowColor: '#163866' },
        default: { shadowColor: '#163866', shadowOpacity: 0.09, shadowRadius: 18, shadowOffset: { width: 0, height: 6 } },
      }) ?? {};

// The navigation bar floats over the content. Anything pinned to the bottom of
// a screen (the add button, snackbars, the last row of a list) keeps this much
// clear, plus the system's bottom inset.
export const NAV_BAR = { height: 68, margin: 14 };
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
// the ground (navy on navy, yellow on white) are pulled toward the ink.
export const lineColor = (mode: TransitMode, routeColor: string | undefined, dark: boolean): string => {
  const valid = routeColor && /^[0-9a-fA-F]{6}$/.test(routeColor);
  let color = mode !== 'walk' && valid ? `#${routeColor}` : TransitModeColors[mode] ?? '#8A8A8A';
  const l = luminance(color);
  if (dark && l < 0.12) color = mix(color, 255, 0.45);
  if (!dark && l > 0.7) color = mix(color, 0, 0.3);
  return color;
};

// Black or white, whichever reads better on the given fill.
export const inkOn = (fill: string): string => (luminance(fill) > 0.3 ? '#14243D' : '#FFFFFF');

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
