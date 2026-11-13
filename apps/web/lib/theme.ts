import { THEMES, THEME_IDS, parseThemeId, type ThemeId } from '@repair/core';
import { cookies } from 'next/headers';

export const THEME_COOKIE = 'theme';

export async function getThemeId(): Promise<ThemeId> {
  return parseThemeId((await cookies()).get(THEME_COOKIE)?.value);
}

// every theme's tokens, so switching in the browser only changes data-theme on <html>
export function themeCss(): string {
  return THEME_IDS.map((id) => {
    const t = THEMES[id];
    const vars = {
      bg: t.bg,
      glow: t.glow,
      card: t.card,
      text: t.text,
      muted: t.muted,
      'accent-a': t.accentA,
      'accent-b': t.accentB,
      'on-accent': t.onAccent,
      link: t.link,
      danger: t.danger,
      warning: t.warning,
      's-new': t.status.new,
      's-assigned': t.status.assigned,
      's-in-progress': t.status.inProgress,
      's-done': t.status.done,
      // glass highlights are light on a dark page and white on a light one
      tint: t.scheme === 'dark' ? t.text : '#ffffff',
    };
    const body = Object.entries(vars)
      .map(([k, v]) => `--${k}:${v};`)
      .join('');
    return `[data-theme='${id}']{color-scheme:${t.scheme};${body}}`;
  }).join('\n');
}
