import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { addComment } from '@repair/api';
import { beforeEach, expect, test, vi } from 'vitest';
import { CommentList } from './CommentList';

vi.mock('@repair/api', () => ({ addComment: vi.fn() }));
vi.mock('../lib/supabase-browser', () => ({ createBrowserDb: () => ({}) }));
const router = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const comments = [
  { id: 1, ticketId: 'ticket-1', authorId: 'u1', body: 'แอร์มีน้ำหยด', createdAt: '2026-11-10T03:00:00Z' },
  { id: 2, ticketId: 'ticket-1', authorId: 'u2', body: 'จะเข้าไปดูบ่ายนี้', createdAt: '2026-11-10T04:30:00Z' },
];

beforeEach(() => {
  vi.resetAllMocks();
});

const setup = () => {
  const user = userEvent.setup();
  render(<CommentList ticketId="ticket-1" comments={comments} people={{ u1: 'ณัฐวุฒิ', u2: 'กิตติพงษ์' }} />);
  return user;
};

test('lists comments oldest first with author and Thai date', () => {
  setup();
  const items = screen.getAllByRole('listitem').map((li) => li.textContent);
  expect(items[0]).toContain('ณัฐวุฒิ');
  expect(items[0]).toContain('10/11/2569 10:00');
  expect(items[0]).toContain('แอร์มีน้ำหยด');
  expect(items[1]).toContain('กิตติพงษ์');
});

test('an empty comment shows the Thai message and does not call addComment', async () => {
  const user = setup();
  await user.type(screen.getByLabelText('เขียนความคิดเห็น'), '   ');
  await user.click(screen.getByRole('button', { name: 'ส่งความคิดเห็น' }));

  const box = screen.getByLabelText('เขียนความคิดเห็น');
  expect(box.getAttribute('aria-invalid')).toBe('true');
  expect(document.getElementById(box.getAttribute('aria-describedby')!)?.textContent).toBe('กรุณากรอกความคิดเห็น');
  expect(addComment).not.toHaveBeenCalled();
});

test('a sent comment clears the box and refreshes the page', async () => {
  vi.mocked(addComment).mockResolvedValue({ ...comments[0]!, id: 3, body: 'ขอบคุณครับ' });
  const user = setup();
  const box = screen.getByLabelText('เขียนความคิดเห็น') as HTMLTextAreaElement;
  await user.type(box, ' ขอบคุณครับ ');
  await user.click(screen.getByRole('button', { name: 'ส่งความคิดเห็น' }));

  expect(addComment).toHaveBeenCalledWith({}, 'ticket-1', 'ขอบคุณครับ');
  await waitFor(() => expect(box.value).toBe(''));
  expect(router.refresh).toHaveBeenCalled();
});

test('a failed comment keeps the text and says so', async () => {
  vi.mocked(addComment).mockRejectedValue(new TypeError('Failed to fetch'));
  const user = setup();
  const box = screen.getByLabelText('เขียนความคิดเห็น') as HTMLTextAreaElement;
  await user.type(box, 'ขอบคุณครับ');
  await user.click(screen.getByRole('button', { name: 'ส่งความคิดเห็น' }));

  expect((await screen.findByRole('alert')).textContent).toBe('ส่งความคิดเห็นไม่สำเร็จ กรุณาลองอีกครั้ง');
  expect(box.value).toBe('ขอบคุณครับ');
});
