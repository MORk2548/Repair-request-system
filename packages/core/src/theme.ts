export const THEME_IDS = ['aurora', 'sunset', 'ocean', 'daylight'] as const;
export type ThemeId = (typeof THEME_IDS)[number];
export const DEFAULT_THEME: ThemeId = 'aurora';

export type Theme = {
  label: string;
  scheme: 'dark' | 'light';
  bg: string;
  /** center of the page's radial gradient */
  glow: string;
  /** solid base under glass cards; the apps draw it translucent */
  card: string;
  text: string;
  muted: string;
  accentA: string;
  accentB: string;
  /** text on the accent gradient */
  onAccent: string;
  link: string;
  danger: string;
  warning: string;
  status: { new: string; assigned: string; inProgress: string; done: string };
};

const DARK_STATUS = { new: '#b9cff8', assigned: '#d2c6ff', inProgress: '#ffd38a', done: '#8ff0d9' };

export const THEMES: Record<ThemeId, Theme> = {
  aurora: {
    label: 'ออโรรา',
    scheme: 'dark',
    bg: '#060918',
    glow: '#10163a',
    card: '#0a0e22',
    text: '#e8ecf8',
    muted: '#8b93b5',
    accentA: '#3ee6c4',
    accentB: '#8a6cff',
    onAccent: '#060918',
    link: '#7ff0d8',
    danger: '#ff9b9b',
    warning: '#ffc457',
    status: DARK_STATUS,
  },
  sunset: {
    label: 'สนธยา',
    scheme: 'dark',
    bg: '#12070f',
    glow: '#2c0f22',
    card: '#1a0b16',
    text: '#fbeef2',
    muted: '#b9949f',
    accentA: '#ff9a5c',
    accentB: '#ff5fa2',
    onAccent: '#12070f',
    link: '#ffbc96',
    danger: '#ff9b9b',
    warning: '#ffd166',
    status: DARK_STATUS,
  },
  ocean: {
    label: 'มหาสมุทร',
    scheme: 'dark',
    bg: '#03101c',
    glow: '#082a44',
    card: '#061827',
    text: '#e6f3fb',
    muted: '#86a3b8',
    accentA: '#4fd1f5',
    accentB: '#8b93ff',
    onAccent: '#03101c',
    link: '#93e4fb',
    danger: '#ff9b9b',
    warning: '#ffc457',
    status: DARK_STATUS,
  },
  daylight: {
    label: 'กลางวัน',
    scheme: 'light',
    bg: '#eef1f8',
    glow: '#ffffff',
    card: '#ffffff',
    text: '#111733',
    muted: '#4b5478',
    accentA: '#0b7d6c',
    accentB: '#5b3fd9',
    onAccent: '#ffffff',
    link: '#0a6b5d',
    danger: '#b42318',
    warning: '#8a5a00',
    status: { new: '#1d4ed8', assigned: '#5b3fd9', inProgress: '#8a5a00', done: '#0a6b5d' },
  },
};

export function parseThemeId(value: string | null | undefined): ThemeId {
  return (THEME_IDS as readonly string[]).includes(value ?? '') ? (value as ThemeId) : DEFAULT_THEME;
}

function channels(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function withAlpha(hex: string, alpha: number): string {
  return `rgba(${channels(hex).join(', ')}, ${alpha})`;
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2 contrast ratio of two #rrggbb colors */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
