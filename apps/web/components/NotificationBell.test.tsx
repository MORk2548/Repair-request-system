import { render, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { NotificationBell } from './NotificationBell';

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const realtime = vi.hoisted(() => {
  const channel = { on: vi.fn(), subscribe: vi.fn() };
  channel.on.mockReturnValue(channel);
  channel.subscribe.mockReturnValue(channel);
  return { channel, removeChannel: vi.fn(), name: vi.fn(() => channel), setAuth: vi.fn(() => Promise.resolve()) };
});
vi.mock('../lib/supabase-browser', () => ({ createBrowserDb: () => ({ channel: realtime.name, removeChannel: realtime.removeChannel, realtime: { setAuth: realtime.setAuth } }) }));

test('subscribes with the user token, refreshes once per burst of changes and unsubscribes on unmount', async () => {
  const { unmount } = render(<NotificationBell userId="user-1" />);
  await waitFor(() => expect(realtime.channel.subscribe).toHaveBeenCalled());
  expect(realtime.setAuth).toHaveBeenCalled();
  const [event, filter, onChange] = realtime.channel.on.mock.calls[0]!;
  expect(event).toBe('postgres_changes');
  expect(filter).toMatchObject({ event: '*', table: 'notifications', filter: 'user_id=eq.user-1' });

  vi.useFakeTimers();
  onChange();
  onChange();
  onChange();
  vi.advanceTimersByTime(300);
  expect(router.refresh).toHaveBeenCalledTimes(1);
  vi.useRealTimers();

  unmount();
  expect(realtime.removeChannel).toHaveBeenCalledWith(realtime.channel);
});
