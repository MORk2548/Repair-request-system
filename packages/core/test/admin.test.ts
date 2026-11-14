import { expect, test } from 'vitest';
import { createUserSchema, equipmentSchema, updateUserSchema } from '../src/index';

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

test("updateUserSchema accepts the seed users' ids, which carry no RFC version digit", () => {
  expect(updateUserSchema.safeParse({ userId: '5eed0000-0000-0000-0000-000000000001', isActive: false }).success).toBe(true);
});
