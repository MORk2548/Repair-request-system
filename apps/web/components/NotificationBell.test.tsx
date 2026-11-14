import { render } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { NotificationBell } from './NotificationBell';

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const realtime = vi.hoisted(() => {
  const channel = { on: vi.fn(), subscribe: vi.fn() };
  channel.on.mockReturnValue(channel);
  channel.subscribe.mockReturnValue(channel);
  return { channel, removeChannel: vi.fn(), name: vi.fn(() => channel) };
});
vi.mock('../lib/supabase-browser', () => ({ createBrowserDb: () => ({ channel: realtime.name, removeChannel: realtime.removeChannel }) }));

test('refreshes the page when a notification arrives for this user and unsubscribes on unmount', () => {
  const { unmount } = render(<NotificationBell userId="user-1" />);
  const [event, filter, onInsert] = realtime.channel.on.mock.calls[0]!;
  expect(event).toBe('postgres_changes');
  expect(filter).toMatchObject({ event: 'INSERT', table: 'notifications', filter: 'user_id=eq.user-1' });

  onInsert();
  expect(router.refresh).toHaveBeenCalledTimes(1);

  unmount();
  expect(realtime.removeChannel).toHaveBeenCalledWith(realtime.channel);
});
