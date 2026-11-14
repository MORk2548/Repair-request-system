import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { markNotificationsRead } from '@repair/api';
import { beforeEach, expect, test, vi } from 'vitest';
import { NotificationList } from './NotificationList';

vi.mock('@repair/api', () => ({ markNotificationsRead: vi.fn(), AdminError: class extends Error {} }));
vi.mock('../lib/supabase-browser', () => ({ createBrowserDb: () => ({}) }));
const router = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const items = [
  { id: 2, ticketId: 'ticket-1', ticketNo: 'RQ-2611-0001', title: 'แอร์ไม่เย็น', toStatus: 'assigned', createdAt: '2026-11-10T04:30:00Z', readAt: null },
  { id: 1, ticketId: 'ticket-1', ticketNo: 'RQ-2611-0001', title: 'แอร์ไม่เย็น', toStatus: 'new', createdAt: '2026-11-10T03:00:00Z', readAt: '2026-11-10T03:05:00Z' },
] as const;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(markNotificationsRead).mockResolvedValue();
});

const setup = () => {
  const user = userEvent.setup();
  render(<NotificationList items={[...items]} />);
  return user;
};

test('shows the Thai message, ticket title and date, and marks unread items', () => {
  setup();
  const unread = screen.getByRole('button', { name: /มอบหมายงาน RQ-2611-0001/ });
  expect(unread.textContent).toContain('แอร์ไม่เย็น');
  expect(unread.textContent).toContain('10/11/2569 11:30');
  expect(unread.textContent).toContain('ยังไม่อ่าน');
  expect(screen.getByRole('button', { name: /ใบแจ้งซ่อมใหม่ RQ-2611-0001/ }).textContent).not.toContain('ยังไม่อ่าน');
});

test('clicking an unread item marks it read and opens the ticket', async () => {
  const user = setup();
  await user.click(screen.getByRole('button', { name: /มอบหมายงาน/ }));
  expect(markNotificationsRead).toHaveBeenCalledWith({}, { ids: [2] });
  expect(router.push).toHaveBeenCalledWith('/tickets/ticket-1');
});

test('a read item opens without a write, and a failed write still opens the ticket', async () => {
  const user = setup();
  await user.click(screen.getByRole('button', { name: /ใบแจ้งซ่อมใหม่/ }));
  expect(markNotificationsRead).not.toHaveBeenCalled();
  expect(router.push).toHaveBeenCalledWith('/tickets/ticket-1');

  vi.mocked(markNotificationsRead).mockRejectedValue(new Error('offline'));
  await user.click(screen.getByRole('button', { name: /มอบหมายงาน/ }));
  await waitFor(() => expect(router.push).toHaveBeenCalledTimes(2));
});

test('อ่านทั้งหมด marks everything read and refreshes', async () => {
  const user = setup();
  await user.click(screen.getByRole('button', { name: 'อ่านทั้งหมด' }));
  expect(markNotificationsRead).toHaveBeenCalledWith({}, 'all');
  await waitFor(() => expect(router.refresh).toHaveBeenCalled());
});

test('no อ่านทั้งหมด button when everything is read, and an empty list says so', () => {
  const { unmount } = render(<NotificationList items={[{ ...items[1] }]} />);
  expect(screen.queryByRole('button', { name: 'อ่านทั้งหมด' })).toBeNull();
  unmount();
  render(<NotificationList items={[]} />);
  expect(screen.getByText('ยังไม่มีการแจ้งเตือน')).toBeTruthy();
});
