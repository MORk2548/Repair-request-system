import { render, screen, waitFor } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import type { Ticket } from '@repair/core';
import { beforeEach, expect, test, vi } from 'vitest';
import { attachPhoto, createTicket, listEquipment } from '@repair/api';
import { TicketForm } from './TicketForm';

vi.mock('@repair/api', () => ({ createTicket: vi.fn(), attachPhoto: vi.fn(), listEquipment: vi.fn() }));
vi.mock('../lib/supabase-browser', () => ({ createBrowserDb: () => ({}) }));
const router = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const categories = [
  { id: 1, name: 'ไฟฟ้า', sortOrder: 1, isActive: true },
  { id: 3, name: 'เครื่องปรับอากาศ', sortOrder: 3, isActive: true },
];

const ticket = { id: 't-1', ticketNo: 'RQ-2611-0001' } as Ticket;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listEquipment).mockResolvedValue([]);
});

const setup = () => {
  const user = userEvent.setup();
  render(<TicketForm categories={categories} />);
  return user;
};

async function fill(user: UserEvent) {
  await user.type(screen.getByLabelText('หัวข้อ'), 'แอร์ไม่เย็น');
  await user.type(screen.getByLabelText('รายละเอียด'), 'ห้องประชุม 2 แอร์ไม่เย็น');
  await user.selectOptions(screen.getByLabelText('หมวดหมู่'), 'เครื่องปรับอากาศ');
  await user.type(screen.getByLabelText('สถานที่'), 'ตึก A ชั้น 3');
}

const png = (name: string) => new File(['x'], name, { type: 'image/png' });
const submitButton = () => screen.getByRole('button', { name: 'ส่งใบแจ้งซ่อม' });
const requestIds = () => vi.mocked(createTicket).mock.calls.map(([, input]) => input.clientRequestId);

test('shows Thai validation message for empty title and does not call createTicket', async () => {
  const user = setup();
  await user.click(submitButton());

  const title = screen.getByLabelText('หัวข้อ');
  expect(title.getAttribute('aria-invalid')).toBe('true');
  expect(document.getElementById(title.getAttribute('aria-describedby')!)?.textContent).toBe('กรุณากรอกหัวข้อ');
  expect(screen.getByText('กรุณาเลือกหมวดหมู่')).toBeTruthy();
  expect(createTicket).not.toHaveBeenCalled();
});

test('double click on submit calls createTicket once and the button stays disabled while sending', async () => {
  let resolve!: (t: Ticket) => void;
  vi.mocked(createTicket).mockReturnValue(new Promise((r) => (resolve = r)));
  const user = setup();
  await fill(user);

  await user.dblClick(submitButton());
  expect(createTicket).toHaveBeenCalledTimes(1);
  expect((submitButton() as HTMLButtonElement).disabled).toBe(true);

  resolve(ticket);
  await waitFor(() => expect(router.push).toHaveBeenCalledWith('/tickets'));
  expect(createTicket).toHaveBeenCalledTimes(1);
});

test('a failed createTicket keeps the typed title and the retry reuses the same clientRequestId', async () => {
  vi.mocked(createTicket).mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(ticket);
  const user = setup();
  await fill(user);

  await user.click(submitButton());
  expect(await screen.findByText('ส่งใบแจ้งซ่อมไม่สำเร็จ กรุณาลองอีกครั้ง')).toBeTruthy();
  expect((screen.getByLabelText('หัวข้อ') as HTMLInputElement).value).toBe('แอร์ไม่เย็น');

  await user.click(submitButton());
  await waitFor(() => expect(router.push).toHaveBeenCalledWith('/tickets'));
  expect(requestIds()).toHaveLength(2);
  expect(requestIds()[1]).toBe(requestIds()[0]);
});

test('photo upload failure keeps the ticket and shows retry button', async () => {
  vi.mocked(createTicket).mockResolvedValue(ticket);
  vi.mocked(attachPhoto)
    .mockResolvedValueOnce({ id: 1 })
    .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    .mockResolvedValueOnce({ id: 2 });
  const user = setup();
  await fill(user);
  await user.upload(screen.getByLabelText('รูป'), [png('a.png'), png('b.png')]);

  await user.click(submitButton());
  expect(await screen.findByText('สร้างใบแจ้งซ่อมแล้ว แต่อัปโหลดรูปไม่สำเร็จ')).toBeTruthy();
  expect(router.push).not.toHaveBeenCalled();

  await user.click(screen.getByRole('button', { name: 'ลองอัปโหลดรูปอีกครั้ง' }));
  await waitFor(() => expect(router.push).toHaveBeenCalledWith('/tickets'));
  expect(vi.mocked(attachPhoto).mock.calls.map(([, id, file]) => [id, file.name])).toEqual([
    ['t-1', 'a.png'],
    ['t-1', 'b.png'],
    ['t-1', 'b.png'],
  ]);
  expect(createTicket).toHaveBeenCalledTimes(1);
});

test('picking equipment fills the location, which stays editable', async () => {
  vi.mocked(listEquipment).mockResolvedValue([
    { id: 7, assetTag: 'AC-0001', name: 'แอร์ห้องประชุมใหญ่', installLocation: 'อาคาร A ชั้น 2', serialNo: null, departmentId: null, status: 'active' },
  ]);
  vi.mocked(createTicket).mockResolvedValue(ticket);
  const user = setup();
  await user.type(screen.getByLabelText('หัวข้อ'), 'แอร์ไม่เย็น');
  await user.type(screen.getByLabelText('รายละเอียด'), 'ไม่เย็น');
  await user.selectOptions(screen.getByLabelText('หมวดหมู่'), 'เครื่องปรับอากาศ');

  await user.type(screen.getByLabelText('อุปกรณ์ (ไม่บังคับ)'), 'AC-0');
  await user.click(await screen.findByRole('button', { name: /AC-0001/ }));
  const location = screen.getByLabelText('สถานที่') as HTMLInputElement;
  expect(location.value).toBe('อาคาร A ชั้น 2');
  expect(listEquipment).toHaveBeenLastCalledWith({}, { q: 'AC-0' });

  await user.type(location, ' ห้อง 201');
  await user.click(submitButton());
  await waitFor(() => expect(createTicket).toHaveBeenCalled());
  expect(vi.mocked(createTicket).mock.calls[0]![1]).toMatchObject({ equipmentId: 7, location: 'อาคาร A ชั้น 2 ห้อง 201' });
});

test('a sixth photo is refused with a Thai message', async () => {
  const user = setup();
  const input = screen.getByLabelText('รูป');
  await user.upload(input, [1, 2, 3, 4, 5].map((i) => png(`${i}.png`)));
  expect(screen.queryByText('แนบรูปได้ไม่เกิน 5 รูป')).toBeNull();

  await user.upload(input, png('6.png'));
  expect(screen.getByText('แนบรูปได้ไม่เกิน 5 รูป')).toBeTruthy();
  expect(screen.getAllByRole('button', { name: /^ลบรูป/ })).toHaveLength(5);
});
