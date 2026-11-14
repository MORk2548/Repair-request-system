import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { SetPasswordForm } from './SetPasswordForm';

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
const auth = vi.hoisted(() => ({ updateUser: vi.fn() }));
vi.mock('../lib/supabase-browser', () => ({ createBrowserDb: () => ({ auth }) }));

beforeEach(() => {
  vi.resetAllMocks();
  auth.updateUser.mockResolvedValue({ error: null });
});

const fill = (password: string, confirm = password) => {
  fireEvent.change(screen.getByLabelText('รหัสผ่านใหม่'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('ยืนยันรหัสผ่าน'), { target: { value: confirm } });
  fireEvent.click(screen.getByRole('button', { name: 'บันทึกรหัสผ่าน' }));
};

test('the rule list ticks off each rule as the password meets it', () => {
  render(<SetPasswordForm />);
  fireEvent.change(screen.getByLabelText('รหัสผ่านใหม่'), { target: { value: 'mangotree' } });
  const passed = screen.getAllByRole('listitem').filter((li) => li.className === 'rule-ok').map((li) => li.textContent);
  expect(passed).toEqual(['✓ ยาวอย่างน้อย 8 ตัวอักษร (ผ่านแล้ว)', '✓ มีตัวพิมพ์เล็ก (a-z) อย่างน้อย 1 ตัว (ผ่านแล้ว)', '✓ ไม่ใช่รหัสผ่านที่เดาง่าย เช่น Password1 หรือ Qwerty123 (ผ่านแล้ว)']);
});

test('a weak password is refused in Thai before anything is sent', () => {
  render(<SetPasswordForm />);
  fill('Password1');
  expect(screen.getByText('รหัสผ่านต้องไม่ใช่รหัสผ่านที่เดาง่าย เช่น Password1 หรือ Qwerty123')).toBeTruthy();
  expect(screen.getByLabelText('รหัสผ่านใหม่').getAttribute('aria-invalid')).toBe('true');
  expect(auth.updateUser).not.toHaveBeenCalled();
});

test('a strong password is saved', async () => {
  render(<SetPasswordForm />);
  fill('Mango7Tree');
  expect(auth.updateUser).toHaveBeenCalledWith({ password: 'Mango7Tree' });
  await vi.waitFor(() => expect(router.replace).toHaveBeenCalledWith('/tickets'));
});
