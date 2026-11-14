import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ForbiddenTransitionError, VersionConflictError, reassignTicket, transitionTicket } from '@repair/api';
import type { Role, Ticket, TicketStatus } from '@repair/core';
import { beforeEach, expect, test, vi } from 'vitest';
import { StatusActions } from './StatusActions';

vi.mock('@repair/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@repair/api')>()),
  transitionTicket: vi.fn(),
  reassignTicket: vi.fn(),
}));
vi.mock('../lib/supabase-browser', () => ({ createBrowserDb: () => ({}) }));
const router = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const technicians = [
  { id: 'tech-1', displayName: 'กิตติพงษ์' },
  { id: 'tech-2', displayName: 'อรทัย' },
  { id: 'tech-3', displayName: 'ณัฐพล' },
];

const ticket = (status: TicketStatus, assigneeId: string | null = null): Ticket => ({
  id: 'ticket-1',
  ticketNo: 'RQ-2611-0001',
  title: 'แอร์ไม่เย็น',
  description: 'ห้องประชุม 2',
  categoryId: 3,
  equipmentId: null,
  priority: 'normal',
  location: 'ตึก A',
  status,
  reporterId: 'reporter-1',
  assigneeId,
  resolution: null,
  resolvedAt: null,
  version: 4,
  createdAt: '2026-11-10T03:00:00Z',
  updatedAt: '2026-11-10T03:00:00Z',
});

const users = {
  reporter: { id: 'reporter-1', role: 'reporter' },
  technician: { id: 'tech-1', role: 'technician' },
  admin: { id: 'admin-1', role: 'admin' },
} satisfies Record<Role, { id: string; role: Role }>;

const setup = (t: Ticket, role: Role) => {
  const user = userEvent.setup();
  render(<StatusActions ticket={t} user={users[role]} technicians={technicians} />);
  return user;
};

const buttonNames = () => screen.queryAllByRole('button').map((b) => b.textContent);

beforeEach(() => {
  vi.resetAllMocks();
});

test('reporter on a done ticket sees only "ปิดงาน" and "ขอแก้ไขใหม่"', () => {
  setup(ticket('done', 'tech-1'), 'reporter');
  expect(buttonNames()).toEqual(['ปิดงาน', 'ขอแก้ไขใหม่']);
});

test('closed ticket renders no action buttons', () => {
  setup(ticket('closed', 'tech-1'), 'admin');
  expect(buttonNames()).toEqual([]);
});

test('technician on a new ticket sees "รับงาน" and it assigns to themself', async () => {
  vi.mocked(transitionTicket).mockResolvedValue(ticket('assigned', 'tech-1'));
  const user = setup(ticket('new'), 'technician');
  expect(buttonNames()).toEqual(['รับงาน']);

  await user.click(screen.getByRole('button', { name: 'รับงาน' }));
  expect(transitionTicket).toHaveBeenCalledWith({}, { ticketId: 'ticket-1', to: 'assigned', expectedVersion: 4, assigneeId: 'tech-1' });
  await waitFor(() => expect(router.refresh).toHaveBeenCalled());
});

test('"ส่งต่อช่างคนอื่น" requires a reason and excludes the current technician from the list', async () => {
  vi.mocked(reassignTicket).mockResolvedValue(ticket('assigned', 'tech-3'));
  const user = setup(ticket('in_progress', 'tech-1'), 'admin');
  await user.click(screen.getByRole('button', { name: 'ส่งต่อช่างคนอื่น' }));

  const select = screen.getByLabelText('ช่างคนใหม่');
  expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['เลือกช่าง', 'อรทัย', 'ณัฐพล']);
  await user.selectOptions(select, 'ณัฐพล');
  await user.click(screen.getByRole('button', { name: 'ยืนยัน' }));

  const reason = screen.getByLabelText('เหตุผล');
  expect(reason.getAttribute('aria-invalid')).toBe('true');
  expect(document.getElementById(reason.getAttribute('aria-describedby')!)?.textContent).toBe('กรุณากรอกเหตุผล');
  expect(reassignTicket).not.toHaveBeenCalled();

  await user.type(reason, 'ไม่มีอะไหล่');
  await user.click(screen.getByRole('button', { name: 'ยืนยัน' }));
  expect(reassignTicket).toHaveBeenCalledWith({}, { ticketId: 'ticket-1', expectedVersion: 4, assigneeId: 'tech-3', reason: 'ไม่มีอะไหล่' });
  await waitFor(() => expect(router.refresh).toHaveBeenCalled());
});

test('a technician who hands a ticket over goes back to the list, since they can no longer see it', async () => {
  vi.mocked(reassignTicket).mockResolvedValue(ticket('assigned', 'tech-2'));
  const user = setup(ticket('assigned', 'tech-1'), 'technician');
  await user.click(screen.getByRole('button', { name: 'ส่งต่อช่างคนอื่น' }));
  await user.selectOptions(screen.getByLabelText('ช่างคนใหม่'), 'อรทัย');
  await user.type(screen.getByLabelText('เหตุผล'), 'ต้องใช้ช่างไฟฟ้า');
  await user.click(screen.getByRole('button', { name: 'ยืนยัน' }));
  // replace, so the back button cannot reopen a ticket they may no longer see
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/tickets'));
  expect(router.push).not.toHaveBeenCalled();
});

test('VersionConflictError shows "มีผู้อื่นอัปเดตใบนี้แล้ว กรุณาโหลดใหม่" and a reload button, ticket state unchanged', async () => {
  vi.mocked(transitionTicket).mockRejectedValue(new VersionConflictError('version_conflict'));
  const user = setup(ticket('assigned', 'tech-1'), 'technician');
  await user.click(screen.getByRole('button', { name: 'เริ่มงาน' }));

  expect((await screen.findByRole('alert')).textContent).toContain('มีผู้อื่นอัปเดตใบนี้แล้ว กรุณาโหลดใหม่');
  expect(router.refresh).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'เริ่มงาน' })).toBeNull();

  await user.click(screen.getByRole('button', { name: 'โหลดใหม่' }));
  expect(router.refresh).toHaveBeenCalledTimes(1);
  expect(transitionTicket).toHaveBeenCalledTimes(1);
});

test('"เสร็จงาน" without a resolution shows "กรุณากรอกวิธีแก้ไข" and does not call transitionTicket', async () => {
  vi.mocked(transitionTicket).mockResolvedValue(ticket('done', 'tech-1'));
  const user = setup(ticket('in_progress', 'tech-1'), 'technician');
  await user.click(screen.getByRole('button', { name: 'เสร็จงาน' }));
  const resolution = screen.getByLabelText('วิธีแก้ไข');
  await user.type(resolution, '   ');
  await user.click(screen.getByRole('button', { name: 'ยืนยัน' }));

  expect(resolution.getAttribute('aria-invalid')).toBe('true');
  expect(document.getElementById(resolution.getAttribute('aria-describedby')!)?.textContent).toBe('กรุณากรอกวิธีแก้ไข');
  expect(transitionTicket).not.toHaveBeenCalled();

  await user.type(resolution, 'เปลี่ยนคอมเพรสเซอร์');
  await user.click(screen.getByRole('button', { name: 'ยืนยัน' }));
  expect(transitionTicket).toHaveBeenCalledWith({}, { ticketId: 'ticket-1', to: 'done', expectedVersion: 4, resolution: 'เปลี่ยนคอมเพรสเซอร์' });
});

test('"ยกเลิกใบแจ้ง" asks for confirmation in the page before cancelling', async () => {
  vi.mocked(transitionTicket).mockResolvedValue(ticket('cancelled'));
  const user = setup(ticket('new'), 'reporter');
  await user.click(screen.getByRole('button', { name: 'ยกเลิกใบแจ้ง' }));
  expect(transitionTicket).not.toHaveBeenCalled();

  await user.click(screen.getByRole('button', { name: 'ไม่ยกเลิก' }));
  expect(buttonNames()).toEqual(['ยกเลิกใบแจ้ง']);

  await user.click(screen.getByRole('button', { name: 'ยกเลิกใบแจ้ง' }));
  await user.click(screen.getByRole('button', { name: 'ยืนยันยกเลิกใบแจ้ง' }));
  expect(transitionTicket).toHaveBeenCalledWith({}, { ticketId: 'ticket-1', to: 'cancelled', expectedVersion: 4 });
});

test('admin assigns a technician, and every button is disabled while the call is pending', async () => {
  let resolve!: (t: Ticket) => void;
  vi.mocked(transitionTicket).mockReturnValue(new Promise((r) => (resolve = r)));
  const user = setup(ticket('new'), 'admin');
  await user.click(screen.getByRole('button', { name: 'มอบหมายช่าง' }));
  await user.selectOptions(screen.getByLabelText('ช่าง'), 'อรทัย');
  await user.dblClick(screen.getByRole('button', { name: 'ยืนยัน' }));

  expect(transitionTicket).toHaveBeenCalledTimes(1);
  expect(transitionTicket).toHaveBeenCalledWith({}, { ticketId: 'ticket-1', to: 'assigned', expectedVersion: 4, assigneeId: 'tech-2' });
  const buttons = screen.getAllByRole('button') as HTMLButtonElement[];
  expect(buttons.length).toBeGreaterThan(0);
  expect(buttons.every((b) => b.disabled)).toBe(true);

  resolve(ticket('assigned', 'tech-2'));
  await waitFor(() => expect(router.refresh).toHaveBeenCalled());
});

test('ForbiddenTransitionError shows "คุณไม่มีสิทธิ์ทำรายการนี้"', async () => {
  vi.mocked(transitionTicket).mockRejectedValue(new ForbiddenTransitionError('forbidden_transition'));
  const user = setup(ticket('done', 'tech-1'), 'reporter');
  await user.click(screen.getByRole('button', { name: 'ปิดงาน' }));
  expect((await screen.findByRole('alert')).textContent).toBe('คุณไม่มีสิทธิ์ทำรายการนี้');
  expect(router.refresh).not.toHaveBeenCalled();
});

test('any other failure shows the generic retry message', async () => {
  vi.mocked(transitionTicket).mockRejectedValue(new TypeError('Failed to fetch'));
  const user = setup(ticket('done', 'tech-1'), 'reporter');
  await user.click(screen.getByRole('button', { name: 'ขอแก้ไขใหม่' }));
  expect((await screen.findByRole('alert')).textContent).toBe('ทำรายการไม่สำเร็จ กรุณาลองอีกครั้ง');
});
