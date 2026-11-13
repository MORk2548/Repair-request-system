import { describe, expect, test } from 'vitest';
import { DEFAULT_THEME, THEMES, THEME_IDS, contrastRatio, parseThemeId, withAlpha } from '../src/index';

describe('parseThemeId', () => {
  test('keeps a known id', () => {
    expect(parseThemeId('sunset')).toBe('sunset');
  });

  test('falls back to the default for anything else', () => {
    expect(DEFAULT_THEME).toBe('aurora');
    expect(parseThemeId(undefined)).toBe('aurora');
    expect(parseThemeId('')).toBe('aurora');
    expect(parseThemeId('toString')).toBe('aurora');
    expect(parseThemeId('<script>')).toBe('aurora');
  });
});

describe('contrastRatio', () => {
  test('matches the WCAG extremes', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  });
});

test('withAlpha turns a hex color into rgba', () => {
  expect(withAlpha('#3ee6c4', 0.25)).toBe('rgba(62, 230, 196, 0.25)');
});

test.each(THEME_IDS)('%s has a Thai label and a scheme', (id) => {
  expect(THEMES[id].label).toMatch(/[฀-๿]/);
  expect(['dark', 'light']).toContain(THEMES[id].scheme);
});

describe.each(THEME_IDS)('%s meets WCAG AA for text', (id) => {
  const t = THEMES[id];
  const readable = { text: t.text, muted: t.muted, link: t.link, danger: t.danger, ...t.status };
  for (const [name, color] of Object.entries(readable)) {
    for (const [surface, back] of [
      ['bg', t.bg],
      ['card', t.card],
    ] as const) {
      test(`${name} on ${surface}`, () => {
        expect(contrastRatio(color, back)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  test('onAccent on both accents', () => {
    expect(contrastRatio(t.onAccent, t.accentA)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t.onAccent, t.accentB)).toBeGreaterThanOrEqual(4.5);
  });
});
