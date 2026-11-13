import { expect, test } from 'vitest';
import { parsePreferences } from './preferences';

const store = (values: Record<string, string>) => ({ get: (name: string) => (name in values ? { value: values[name]! } : undefined) });

test('reads known cookie values', () => {
  expect(parsePreferences(store({ theme: 'dark', font_scale: 'xlarge' }))).toEqual({ theme: 'dark', font_scale: 'xlarge' });
});

test('falls back to light and normal for missing or unknown values', () => {
  expect(parsePreferences(store({}))).toEqual({ theme: 'light', font_scale: 'normal' });
  expect(parsePreferences(store({ theme: 'aurora', font_scale: 'huge' }))).toEqual({ theme: 'light', font_scale: 'normal' });
});
