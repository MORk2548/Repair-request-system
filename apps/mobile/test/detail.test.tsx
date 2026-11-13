import { addComment, getTicket, listTechnicians, reassignTicket, transitionTicket, type TicketDetail } from '@repair/api';
import type { Role } from '@repair/core';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import TicketScreen from '../app/tickets/[id]';
import { useProfile } from '../lib/useProfile';

jest.mock('@repair/api', () => ({
  getTicket: jest.fn(),
  listTechnicians: jest.fn(),
  transitionTicket: jest.fn(),
  reassignTicket: jest.fn(),
  addComment: jest.fn(),
  VersionConflictError: class VersionConflictError extends Error {},
  ForbiddenTransitionError: class ForbiddenTransitionError extends Error {},
}));
jest.mock('../lib/supabase', () => ({ db: {} }));
jest.mock('../lib/useProfile', () => ({ useProfile: jest.fn() }));
const mockRouter = { dismissTo: jest.fn(), push: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({ id: 't-1' }), Stack: { Screen: () => null } }));

const api = jest.requireMock('@repair/api');

const detail = (over: Partial<TicketDetail> = {}): TicketDetail => ({
  id: 't-1',
  ticketNo: 'RQ-2611-0001',
  title: 'แอร์ไม่เย็น',
  description: 'ห้องประชุม 2 แอร์ไม่เย็น',
  categoryId: 1,
  equipmentId: 7,
  priority: 'urgent',
  location: 'ตึก A ชั้น 3',
  status: 'assigned',
  reporterId: 'rep',
  assigneeId: 'tech-1',
  resolution: null,
  resolvedAt: null,
  version: 3,
  createdAt: '2026-11-12T03:05:00Z',
  updatedAt: '2026-11-12T04:10:00Z',
  categoryName: 'เครื่องปรับอากาศ',
  equipment: { assetTag: 'AC-01', name: 'แอร์ ห้อง 101' },
  people: { rep: 'ณัฐวุฒิ', 'tech-1': 'กิตติพงษ์', 'tech-2': 'อรทัย', admin: 'ผู้ดูแล' },
  photos: [{ id: 1, url: 'https://example.test/p1.jpg' }],
  comments: [{ id: 1, ticketId: 't-1', authorId: 'rep', body: 'รีบหน่อยครับ', createdAt: '2026-11-12T03:30:00Z' }],
  events: [
    { id: 1, ticketId: 't-1', actorId: 'rep', action: 'created', fromStatus: null, toStatus: 'new', detail: null, createdAt: '2026-11-12T03:05:00Z' },
    { id: 2, ticketId: 't-1', actorId: 'admin', action: 'reassigned', fromStatus: 'assigned', toStatus: 'assigned', detail: 'ต้องใช้ช่างแอร์', createdAt: '2026-11-12T04:10:00Z' },
  ],
  ...over,
});

const technicians = [
  { id: 'tech-1', displayName: 'กิตติพงษ์' },
  { id: 'tech-2', displayName: 'อรทัย' },
  { id: 'tech-3', displayName: 'ณัฐพล' },
];

async function open(ticket: TicketDetail | null, me: { id: string; role: Role }) {
  jest.mocked(useProfile).mockReturnValue({ userId: me.id, profile: { id: me.id, displayName: me.id, role: me.role } });
  jest.mocked(getTicket).mockResolvedValue(ticket);
  jest.mocked(listTechnicians).mockResolvedValue(technicians);
  const user = userEvent.setup();
  await render(<TicketScreen />);
  if (ticket) await screen.findByText(ticket.title);
  return user;
}

beforeEach(() => jest.resetAllMocks());

test('technician assigned to ticket sees "เริ่มงาน" on assigned ticket', async () => {
  const user = await open(detail(), { id: 'tech-1', role: 'technician' });

  expect(screen.getByText('มอบหมายแล้ว')).toBeTruthy();
  expect(screen.getByText('ด่วน')).toBeTruthy();
  expect(screen.getByText('AC-01 แอร์ ห้อง 101')).toBeTruthy();
  expect(screen.getByText('กิตติพงษ์')).toBeTruthy();
  expect(screen.getAllByText('ณัฐวุฒิ')).toHaveLength(2);
  expect(screen.getAllByText('12/11/2569 10:05')).toHaveLength(2);
  expect(screen.getByText('ส่งต่องาน')).toBeTruthy();
  expect(screen.getByText('เหตุผล: ต้องใช้ช่างแอร์')).toBeTruthy();
  expect(screen.getByText('รีบหน่อยครับ')).toBeTruthy();
  expect(screen.getByLabelText('รูปที่ 1 ของใบ RQ-2611-0001 (แตะเพื่อดูขนาดเต็ม)')).toBeTruthy();

  jest.mocked(transitionTicket).mockResolvedValue(detail({ status: 'in_progress' }));
  await user.press(screen.getByRole('button', { name: 'เริ่มงาน' }));
  expect(transitionTicket).toHaveBeenCalledWith({}, { ticketId: 't-1', expectedVersion: 3, to: 'in_progress' });
  await waitFor(() => expect(getTicket).toHaveBeenCalledTimes(2));
});

test('VersionConflictError shows reload message', async () => {
  const user = await open(detail(), { id: 'tech-1', role: 'technician' });
  jest.mocked(transitionTicket).mockRejectedValue(new api.VersionConflictError('version_conflict'));

  await user.press(screen.getByRole('button', { name: 'เริ่มงาน' }));
  expect(await screen.findByText('มีผู้อื่นอัปเดตใบนี้แล้ว กรุณาโหลดใหม่')).toBeTruthy();
  expect(screen.getByText('มอบหมายแล้ว')).toBeTruthy();
  expect(getTicket).toHaveBeenCalledTimes(1);

  await user.press(screen.getByRole('button', { name: 'โหลดใหม่' }));
  await waitFor(() => expect(getTicket).toHaveBeenCalledTimes(2));
});

test('a missing ticket shows "ไม่พบใบแจ้งซ่อมนี้"', async () => {
  await open(null, { id: 'rep', role: 'reporter' });
  expect(await screen.findByText('ไม่พบใบแจ้งซ่อมนี้')).toBeTruthy();
});

test('reporter on their own done ticket sees only "ปิดงาน" and "ขอแก้ไขใหม่"', async () => {
  await open(detail({ status: 'done', resolution: 'เปลี่ยนคอมเพรสเซอร์', resolvedAt: '2026-11-12T05:00:00Z' }), { id: 'rep', role: 'reporter' });

  const actions = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel);
  expect(actions.filter((a) => a !== 'ส่งความคิดเห็น' && !a.startsWith('รูปที่'))).toEqual(['ปิดงาน', 'ขอแก้ไขใหม่']);
  expect(screen.getByText('เปลี่ยนคอมเพรสเซอร์')).toBeTruthy();
  expect(listTechnicians).not.toHaveBeenCalled();
});

test('"เสร็จงาน" without a resolution shows "กรุณากรอกวิธีแก้ไข" and calls nothing', async () => {
  const user = await open(detail({ status: 'in_progress' }), { id: 'tech-1', role: 'technician' });

  await user.press(screen.getByRole('button', { name: 'เสร็จงาน' }));
  await user.press(screen.getByRole('button', { name: 'ยืนยัน' }));
  expect(await screen.findByText('กรุณากรอกวิธีแก้ไข')).toBeTruthy();
  expect(transitionTicket).not.toHaveBeenCalled();

  jest.mocked(transitionTicket).mockResolvedValue(detail({ status: 'done' }));
  await user.type(screen.getByLabelText('วิธีแก้ไข'), 'เติมน้ำยาแอร์');
  await user.press(screen.getByRole('button', { name: 'ยืนยัน' }));
  expect(transitionTicket).toHaveBeenCalledWith({}, { ticketId: 't-1', expectedVersion: 3, to: 'done', resolution: 'เติมน้ำยาแอร์' });
});

test('"ส่งต่อช่างคนอื่น" requires a reason and excludes the current technician, then leaves the ticket', async () => {
  const user = await open(detail(), { id: 'tech-1', role: 'technician' });

  await user.press(screen.getByRole('button', { name: 'ส่งต่อช่างคนอื่น' }));
  expect(screen.queryByRole('radio', { name: 'กิตติพงษ์' })).toBeNull();
  expect(screen.getByRole('radio', { name: 'ณัฐพล' })).toBeTruthy();

  await user.press(screen.getByRole('radio', { name: 'อรทัย' }));
  await user.press(screen.getByRole('button', { name: 'ยืนยัน' }));
  expect(await screen.findByText('กรุณากรอกเหตุผล')).toBeTruthy();
  expect(reassignTicket).not.toHaveBeenCalled();

  jest.mocked(reassignTicket).mockResolvedValue(detail({ assigneeId: 'tech-2' }));
  await user.type(screen.getByLabelText('เหตุผล'), 'ต้องใช้ช่างไฟ');
  await user.press(screen.getByRole('button', { name: 'ยืนยัน' }));
  expect(reassignTicket).toHaveBeenCalledWith({}, { ticketId: 't-1', expectedVersion: 3, assigneeId: 'tech-2', reason: 'ต้องใช้ช่างไฟ' });
  await waitFor(() => expect(mockRouter.dismissTo).toHaveBeenCalledWith('/tickets'));
});

test('admin assigns a new ticket and cancelling asks to confirm first', async () => {
  const user = await open(detail({ status: 'new', assigneeId: null }), { id: 'admin', role: 'admin' });

  await user.press(screen.getByRole('button', { name: 'ยกเลิกใบแจ้ง' }));
  expect(transitionTicket).not.toHaveBeenCalled();
  await user.press(screen.getByRole('button', { name: 'ไม่ยกเลิก' }));

  jest.mocked(transitionTicket).mockResolvedValue(detail({ status: 'assigned' }));
  await user.press(screen.getByRole('button', { name: 'มอบหมายช่าง' }));
  await user.press(screen.getByRole('button', { name: 'ยืนยัน' }));
  expect(await screen.findByText('กรุณาเลือกช่าง')).toBeTruthy();
  await user.press(screen.getByRole('radio', { name: 'กิตติพงษ์' }));
  await user.press(screen.getByRole('button', { name: 'ยืนยัน' }));
  expect(transitionTicket).toHaveBeenCalledWith({}, { ticketId: 't-1', expectedVersion: 3, to: 'assigned', assigneeId: 'tech-1' });
});

test('ForbiddenTransitionError shows "คุณไม่มีสิทธิ์ทำรายการนี้", other errors a retry message', async () => {
  const user = await open(detail(), { id: 'tech-1', role: 'technician' });

  jest.mocked(transitionTicket).mockRejectedValueOnce(new api.ForbiddenTransitionError('forbidden_transition'));
  await user.press(screen.getByRole('button', { name: 'เริ่มงาน' }));
  expect(await screen.findByText('คุณไม่มีสิทธิ์ทำรายการนี้')).toBeTruthy();

  jest.mocked(transitionTicket).mockRejectedValueOnce(new Error('network'));
  await user.press(screen.getByRole('button', { name: 'เริ่มงาน' }));
  expect(await screen.findByText('ทำรายการไม่สำเร็จ กรุณาลองอีกครั้ง')).toBeTruthy();
});

test('an empty comment shows a Thai message; a sent comment clears the box and reloads', async () => {
  const user = await open(detail(), { id: 'rep', role: 'reporter' });

  await user.press(screen.getByRole('button', { name: 'ส่งความคิดเห็น' }));
  expect(await screen.findByText('กรุณากรอกความคิดเห็น')).toBeTruthy();
  expect(addComment).not.toHaveBeenCalled();

  jest.mocked(addComment).mockResolvedValue({ id: 2, ticketId: 't-1', authorId: 'rep', body: 'ขอบคุณครับ', createdAt: '2026-11-12T06:00:00Z' });
  await user.type(screen.getByLabelText('เขียนความคิดเห็น'), 'ขอบคุณครับ');
  await user.press(screen.getByRole('button', { name: 'ส่งความคิดเห็น' }));
  expect(addComment).toHaveBeenCalledWith({}, 't-1', 'ขอบคุณครับ');
  await waitFor(() => expect(screen.getByLabelText('เขียนความคิดเห็น').props.value).toBe(''));
  expect(getTicket).toHaveBeenCalledTimes(2);
});
