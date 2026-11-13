import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { SettingsForm } from './SettingsForm';

const router = { refresh: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router }));

beforeEach(() => {
  vi.resetAllMocks();
  document.cookie = 'theme=; max-age=0; path=/';
  document.cookie = 'font_scale=; max-age=0; path=/';
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.fontScale;
});

const radio = (group: string, name: string) =>
  within(screen.getByRole('group', { name: group })).getByRole<HTMLInputElement>('radio', { name });

test('shows both settings in Thai with the current values checked', () => {
  render(<SettingsForm current={{ theme: 'dark', font_scale: 'large' }} />);
  expect(radio('โหมดการแสดงผล', 'มืด').checked).toBe(true);
  expect(radio('ขนาดตัวอักษร', 'ใหญ่').checked).toBe(true);
  expect(radio('ขนาดตัวอักษร', 'ใหญ่มาก').checked).toBe(false);
});

test('choosing a value applies it to the page, stores it in a cookie and refreshes', async () => {
  const user = userEvent.setup();
  render(<SettingsForm current={{ theme: 'light', font_scale: 'normal' }} />);

  await user.click(radio('โหมดการแสดงผล', 'มืด'));
  await user.click(radio('ขนาดตัวอักษร', 'ใหญ่มาก'));

  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(document.documentElement.dataset.fontScale).toBe('xlarge');
  expect(document.cookie).toContain('theme=dark');
  expect(document.cookie).toContain('font_scale=xlarge');
  expect(radio('ขนาดตัวอักษร', 'ใหญ่มาก').checked).toBe(true);
  expect(router.refresh).toHaveBeenCalledTimes(2);
});
