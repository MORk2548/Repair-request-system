import { expect, test } from 'vitest';
import { createUserSchema, equipmentSchema, setPasswordSchema, updateUserSchema } from '../src/index';

const firstMessage = (r: { success: boolean; error?: { issues: { message: string }[] } }) => r.error?.issues[0]?.message;

test('createUserSchema trims and lower-cases the email and explains a bad one in Thai', () => {
  expect(createUserSchema.parse({ email: ' New@Test.Local ', displayName: 'ก', role: 'reporter', departmentId: null }).email).toBe('new@test.local');
  expect(firstMessage(createUserSchema.safeParse({ email: 'nope', displayName: 'ก', role: 'reporter', departmentId: null }))).toBe(
    'กรุณากรอกอีเมลให้ถูกต้อง',
  );
});

test('equipmentSchema stores blank optional text as null', () => {
  const v = equipmentSchema.parse({ assetTag: 'A-1', name: 'แอร์', serialNo: ' ', departmentId: null, installLocation: '', status: 'active' });
  expect(v).toMatchObject({ serialNo: null, installLocation: null });
});

test('setPasswordSchema needs 8 characters and a matching confirmation', () => {
  expect(firstMessage(setPasswordSchema.safeParse({ password: 'short', confirm: 'short' }))).toBe('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
  expect(setPasswordSchema.safeParse({ password: 'longenough', confirm: 'different' }).error?.issues[0]).toMatchObject({
    path: ['confirm'],
    message: 'รหัสผ่านทั้งสองช่องไม่ตรงกัน',
  });
  expect(setPasswordSchema.safeParse({ password: 'longenough', confirm: 'longenough' }).success).toBe(true);
});

test("updateUserSchema accepts the seed users' ids, which carry no RFC version digit", () => {
  expect(updateUserSchema.safeParse({ userId: '5eed0000-0000-0000-0000-000000000001', isActive: false }).success).toBe(true);
});
