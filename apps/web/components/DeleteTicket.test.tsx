import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { DeleteTicket } from './DeleteTicket';

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('../lib/supabase-browser', () => ({ createBrowserDb: () => ({}) }));
const api = vi.hoisted(() => ({ deleteTicket: vi.fn() }));
vi.mock('@repair/api', () => api);

beforeEach(() => vi.resetAllMocks());

test('asks to confirm before deleting, then leaves for the list', async () => {
  api.deleteTicket.mockResolvedValue(undefined);
  render(<DeleteTicket ticketId="t-1" ticketNo="RQ-2611-0001" />);
  fireEvent.click(screen.getByRole('button', { name: 'ลบใบแจ้งซ่อม' }));
  expect(api.deleteTicket).not.toHaveBeenCalled();
  expect(screen.getByRole('alert').textContent).toContain('กู้คืนไม่ได้');
  fireEvent.click(screen.getByRole('button', { name: 'ยืนยันลบ RQ-2611-0001' }));
  expect(api.deleteTicket).toHaveBeenCalledWith({}, 't-1');
  await vi.waitFor(() => expect(router.replace).toHaveBeenCalledWith('/tickets'));
});

test('cancel goes back without deleting', () => {
  render(<DeleteTicket ticketId="t-1" ticketNo="RQ-2611-0001" />);
  fireEvent.click(screen.getByRole('button', { name: 'ลบใบแจ้งซ่อม' }));
  fireEvent.click(screen.getByRole('button', { name: 'ยกเลิก' }));
  expect(screen.getByRole('button', { name: 'ลบใบแจ้งซ่อม' })).toBeTruthy();
  expect(api.deleteTicket).not.toHaveBeenCalled();
});

test('a failure shows a Thai error and stays on the page', async () => {
  api.deleteTicket.mockRejectedValue(new Error('forbidden'));
  render(<DeleteTicket ticketId="t-1" ticketNo="RQ-2611-0001" />);
  fireEvent.click(screen.getByRole('button', { name: 'ลบใบแจ้งซ่อม' }));
  fireEvent.click(screen.getByRole('button', { name: 'ยืนยันลบ RQ-2611-0001' }));
  expect(await screen.findByText('ลบใบไม่สำเร็จ กรุณาลองอีกครั้ง')).toBeTruthy();
  expect(router.replace).not.toHaveBeenCalled();
});
