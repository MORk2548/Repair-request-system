import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminError, DuplicateAssetTagError, adminCreateUser, adminUpdateUser, saveCategory, saveEquipment } from '@repair/api';
import type { AdminUser } from '@repair/core';
import type { ReactNode } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';
import { EquipmentForm } from './EquipmentRow';
import { InviteUserForm } from './InviteUserForm';
import { LookupRow } from './LookupRow';
import { UserRow } from './UserRow';

vi.mock('@repair/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@repair/api')>()),
  adminCreateUser: vi.fn(),
  adminUpdateUser: vi.fn(),
  saveCategory: vi.fn(),
  saveDepartment: vi.fn(),
  saveEquipment: vi.fn(),
}));
vi.mock('../lib/supabase-browser', () => ({ createBrowserDb: () => ({}) }));
const router = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const departments = [
  { id: 1, name: 'ฝ่ายไอที', isActive: true },
  { id: 2, name: 'ฝ่ายเก่า', isActive: false },
];

const U1 = '00000000-0000-4000-8000-000000000001';
const user: AdminUser = { id: U1, email: 'tech@test.local', displayName: 'ช่างหนึ่ง', role: 'technician', departmentId: 1, isActive: true };

const inTable = (row: ReactNode) =>
  render(
    <table>
      <tbody>{row}</tbody>
    </table>,
  );

beforeEach(() => vi.resetAllMocks());

test('the invite form shows Thai validation messages and does not call adminCreateUser', async () => {
  const u = userEvent.setup();
  render(<InviteUserForm departments={departments} />);
  await u.click(screen.getByRole('button', { name: 'ส่งคำเชิญ' }));

  const email = screen.getByLabelText('อีเมล');
  expect(email.getAttribute('aria-invalid')).toBe('true');
  expect(document.getElementById(email.getAttribute('aria-describedby')!)?.textContent).toBe('กรุณากรอกอีเมลให้ถูกต้อง');
  expect(screen.getByText('กรุณากรอกชื่อ')).toBeTruthy();
  expect(adminCreateUser).not.toHaveBeenCalled();
});

test('inviting a taken email shows the Edge Function message', async () => {
  vi.mocked(adminCreateUser).mockRejectedValue(new AdminError('อีเมลนี้มีผู้ใช้แล้ว', 409));
  const u = userEvent.setup();
  render(<InviteUserForm departments={departments} />);
  await u.type(screen.getByLabelText('อีเมล'), 'Tech@Test.local');
  await u.type(screen.getByLabelText('ชื่อ'), 'ช่างสอง');
  await u.selectOptions(screen.getByLabelText('บทบาท'), 'ช่าง');
  await u.click(screen.getByRole('button', { name: 'ส่งคำเชิญ' }));

  expect((await screen.findByRole('alert')).textContent).toBe('อีเมลนี้มีผู้ใช้แล้ว');
  expect(adminCreateUser).toHaveBeenCalledWith({}, { email: 'tech@test.local', displayName: 'ช่างสอง', role: 'technician', departmentId: null });
  expect((screen.getByLabelText('ชื่อ') as HTMLInputElement).value).toBe('ช่างสอง');
});

test("the admin's own row has no deactivate control and no role select", async () => {
  const u = userEvent.setup();
  inTable(<UserRow user={{ ...user, role: 'admin' }} departments={departments} isSelf />);
  expect(screen.queryByRole('button', { name: 'ปิดใช้งาน' })).toBeNull();

  await u.click(screen.getByRole('button', { name: 'แก้ไข' }));
  expect(screen.queryByLabelText('บทบาท')).toBeNull();
  await u.click(screen.getByRole('button', { name: 'บันทึก' }));
  expect(adminUpdateUser).toHaveBeenCalledWith({}, { userId: U1, displayName: 'ช่างหนึ่ง', departmentId: 1 });
});

test('deactivating a user waits for the in-page confirmation', async () => {
  vi.mocked(adminUpdateUser).mockResolvedValue({ ...user, isActive: false });
  const u = userEvent.setup();
  inTable(<UserRow user={user} departments={departments} isSelf={false} />);

  await u.click(screen.getByRole('button', { name: 'ปิดใช้งาน' }));
  expect(adminUpdateUser).not.toHaveBeenCalled();
  expect(screen.getByText('ยืนยันปิดใช้งาน ช่างหนึ่ง หรือไม่')).toBeTruthy();

  await u.click(screen.getByRole('button', { name: 'ยืนยัน' }));
  expect(adminUpdateUser).toHaveBeenCalledWith({}, { userId: U1, isActive: false });
  await waitFor(() => expect(router.refresh).toHaveBeenCalled());
});

test('switching a category off saves it with isActive false', async () => {
  vi.mocked(saveCategory).mockResolvedValue({ id: 4, name: 'ประปา', sortOrder: 2, isActive: false });
  const u = userEvent.setup();
  inTable(<LookupRow kind="category" item={{ id: 4, name: 'ประปา', sortOrder: 2, isActive: true }} />);

  await u.click(screen.getByRole('button', { name: 'ปิดใช้งาน' }));
  expect(saveCategory).toHaveBeenCalledWith({}, { id: 4, name: 'ประปา', sortOrder: 2, isActive: false });
  await waitFor(() => expect(router.refresh).toHaveBeenCalled());
});

test('a duplicate asset tag is shown on the asset tag field', async () => {
  vi.mocked(saveEquipment).mockRejectedValue(new DuplicateAssetTagError('duplicate key'));
  const u = userEvent.setup();
  render(<EquipmentForm departments={departments} />);
  await u.type(screen.getByLabelText('รหัสทรัพย์สิน'), 'AC-0001');
  await u.type(screen.getByLabelText('ชื่ออุปกรณ์'), 'front 01');
  await u.type(screen.getByLabelText('หมายเลขจอ (SN)'), '6CM4191G2Y');
  await u.type(screen.getByLabelText('ผู้ใช้งาน'), 'พี่มณี');
  await u.click(screen.getByRole('button', { name: 'เพิ่มอุปกรณ์' }));

  const tag = screen.getByLabelText('รหัสทรัพย์สิน');
  await waitFor(() => expect(tag.getAttribute('aria-invalid')).toBe('true'));
  expect(document.getElementById(tag.getAttribute('aria-describedby')!)?.textContent).toBe('รหัสทรัพย์สินนี้มีอยู่แล้ว');
  expect(saveEquipment).toHaveBeenCalledWith({}, expect.objectContaining({ assetTag: 'AC-0001', serialNo: null, monitorSerialNo: '6CM4191G2Y', userName: 'พี่มณี', status: 'active' }));
  expect(router.refresh).not.toHaveBeenCalled();
});
