import { MD3LightTheme, MD3DarkTheme, MD3Theme, configureFonts, useTheme } from 'react-native-paper';
import { TransitMode } from '../types';

// "Sentier": the day is one trail on a neutral charcoal ground.
// Colour jobs:
//   gold      one flat field: when to leave, the selected tab, the primary action
//   teal      offers and good news (free time, green walks, on time)
//   vermilion warnings only (stairs, late, does not fit)
//   line colours   each transit line's own colour, on the trail blazes
// Dark is the designed scheme; light keeps the same roles for bright sunlight.

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

export const DarkTheme: MD3Theme = {
  ...MD3DarkTheme,
  fonts,
  roundness: 2,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#F7B500',
    onPrimary: '#111111',
    primaryContainer: '#3A2D00',
    onPrimaryContainer: '#FFE08A',
    secondary: '#5CC5BC',
    onSecondary: '#062B28',
    secondaryContainer: '#163A37',
    onSecondaryContainer: '#B4EBE5',
    tertiary: '#F2907A',
    onTertiary: '#3A0E05',
    tertiaryContainer: '#55231A',
    onTertiaryContainer: '#FFD3C8',
    error: '#F2907A',
    onError: '#3A0E05',
    errorContainer: '#55231A',
    onErrorContainer: '#FFD3C8',
    background: '#111111',
    onBackground: '#E8E8E8',
    surface: '#1A1A1A',
    onSurface: '#E8E8E8',
    surfaceVariant: '#262626',
    onSurfaceVariant: '#B3B3B3',
    outline: '#6B6B6B',
    outlineVariant: '#303030',
    inverseSurface: '#E8E8E8',
    inverseOnSurface: '#1A1A1A',
    inversePrimary: '#7A5600',
    surfaceDisabled: 'rgba(232,232,232,0.12)',
    onSurfaceDisabled: 'rgba(232,232,232,0.38)',
    backdrop: 'rgba(0,0,0,0.6)',
    elevation: {
      level0: 'transparent',
      level1: '#1A1A1A',
      level2: '#1F1F1F',
      level3: '#262626',
      level4: '#2A2A2A',
      level5: '#2E2E2E',
    },
  },
};

export const LightTheme: MD3Theme = {
  ...MD3LightTheme,
  fonts,
  roundness: 2,
  colors: {
    ...MD3LightTheme.colors,
    // Gold is too light to read as text on white, so text-coloured uses of
    // "primary" get a deep gold; the flat gold field comes from useTokens().
    primary: '#6E4E00',
    onPrimary: '#FFFFFF',
    primaryContainer: '#FFE7A3',
    onPrimaryContainer: '#2B1E00',
    secondary: '#00716A',
    onSecondary: '#FFFFFF',
    secondaryContainer: '#D2EFEC',
    onSecondaryContainer: '#00302C',
    tertiary: '#A8371C',
    onTertiary: '#FFFFFF',
    tertiaryContainer: '#FFDAD1',
    onTertiaryContainer: '#3A0E05',
    error: '#A8371C',
    onError: '#FFFFFF',
    errorContainer: '#FFDAD1',
    onErrorContainer: '#3A0E05',
    background: '#F7F7F7',
    onBackground: '#1A1A1A',
    surface: '#FFFFFF',
    onSurface: '#1A1A1A',
    surfaceVariant: '#EBEBEB',
    onSurfaceVariant: '#565656',
    outline: '#8A8A8A',
    outlineVariant: '#D6D6D6',
    inverseSurface: '#262626',
    inverseOnSurface: '#F0F0F0',
    inversePrimary: '#F7B500',
    elevation: {
      level0: 'transparent',
      level1: '#FFFFFF',
      level2: '#FAFAFA',
      level3: '#F2F2F2',
      level4: '#EEEEEE',
      level5: '#EBEBEB',
    },
  },
};

export const useAppTheme = () => useTheme<MD3Theme>();

// Colours with a fixed job that Material's roles do not name.
export const useTokens = () => {
  const theme = useAppTheme();
  return {
    gold: '#F7B500', // the flat field, same in both schemes
    onGold: '#111111',
    teal: theme.colors.secondary,
    warn: theme.colors.error,
    rail: theme.dark ? '#3A3A3A' : '#CFCFCF', // the trail line
    post: theme.colors.onSurface, // event markers
    hairline: theme.colors.outlineVariant,
    muted: theme.colors.onSurfaceVariant,
  };
};

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

export const modeIcon = (mode: TransitMode): string =>
  ({ walk: 'walk', metro: 'subway-variant', rem: 'train', bus: 'bus', bike: 'bike', train: 'train-variant' })[mode] ??
  'navigation';
