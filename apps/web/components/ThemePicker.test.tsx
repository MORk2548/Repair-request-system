import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test } from 'vitest';
import { ThemePicker } from './ThemePicker';

beforeEach(() => {
  document.cookie = 'theme=; max-age=0; path=/';
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.scheme;
});

test('offers every theme by its Thai name with the current one checked', () => {
  render(<ThemePicker current="ocean" />);
  const radios = screen.getAllByRole('radio');
  expect(radios.map((r) => r.getAttribute('aria-label') ?? (r as HTMLInputElement).labels?.[0]?.textContent)).toEqual([
    'ออโรรา',
    'สนธยา',
    'มหาสมุทร',
    'กลางวัน',
  ]);
  expect((screen.getByRole('radio', { name: 'มหาสมุทร' }) as HTMLInputElement).checked).toBe(true);
});

test('picking a theme applies it to the page and remembers it in a cookie', async () => {
  const user = userEvent.setup();
  render(<ThemePicker current="aurora" />);
  await user.click(screen.getByRole('radio', { name: 'กลางวัน' }));
  expect(document.documentElement.dataset.theme).toBe('daylight');
  expect(document.documentElement.dataset.scheme).toBe('light');
  expect(document.cookie).toContain('theme=daylight');
  expect((screen.getByRole('radio', { name: 'กลางวัน' }) as HTMLInputElement).checked).toBe(true);
});
