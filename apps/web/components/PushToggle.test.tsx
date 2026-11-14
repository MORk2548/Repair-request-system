import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { PushToggle } from './PushToggle';

const push = vi.hoisted(() => ({ readPushState: vi.fn(), enablePush: vi.fn(), disablePush: vi.fn() }));
vi.mock('../lib/webPush', () => push);
vi.mock('../lib/supabase-browser', () => ({ createBrowserDb: () => ({}) }));

beforeEach(() => {
  vi.resetAllMocks();
});

test('turns notifications on for this device', async () => {
  push.readPushState.mockResolvedValue('off');
  push.enablePush.mockResolvedValue('on');
  render(<PushToggle />);
  fireEvent.click(await screen.findByRole('button', { name: 'เปิดการแจ้งเตือน' }));
  expect(await screen.findByRole('button', { name: 'ปิดการแจ้งเตือน' })).toBeTruthy();
  expect(screen.getByText('เปิดอยู่บนอุปกรณ์นี้')).toBeTruthy();
});

test('a refused permission explains how to allow it and offers no button', async () => {
  push.readPushState.mockResolvedValue('off');
  push.enablePush.mockResolvedValue('denied');
  render(<PushToggle />);
  fireEvent.click(await screen.findByRole('button', { name: 'เปิดการแจ้งเตือน' }));
  expect(await screen.findByText(/ปิดสิทธิ์การแจ้งเตือน/)).toBeTruthy();
  expect(screen.queryByRole('button')).toBeNull();
});

test('turns notifications off', async () => {
  push.readPushState.mockResolvedValue('on');
  push.disablePush.mockResolvedValue(undefined);
  render(<PushToggle />);
  fireEvent.click(await screen.findByRole('button', { name: 'ปิดการแจ้งเตือน' }));
  expect(await screen.findByRole('button', { name: 'เปิดการแจ้งเตือน' })).toBeTruthy();
});

test('an iPhone outside the Home Screen app is told to add it first', async () => {
  push.readPushState.mockResolvedValue('home-screen');
  render(<PushToggle />);
  expect(await screen.findByText(/เพิ่มไปยังหน้าจอโฮม/)).toBeTruthy();
});

test('a failure shows a Thai error and keeps the button', async () => {
  push.readPushState.mockResolvedValue('off');
  push.enablePush.mockRejectedValue(new Error('push service down'));
  render(<PushToggle />);
  fireEvent.click(await screen.findByRole('button', { name: 'เปิดการแจ้งเตือน' }));
  expect((await screen.findByRole('alert')).textContent).toBe('เปิดการแจ้งเตือนไม่สำเร็จ ลองใหม่อีกครั้ง');
  expect(screen.getByRole('button', { name: 'เปิดการแจ้งเตือน' })).toBeTruthy();
});
