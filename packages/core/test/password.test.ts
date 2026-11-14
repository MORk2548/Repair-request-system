import { expect, test } from 'vitest';
import { setPasswordSchema } from '../src/index';

const check = (password: string, confirm = password) => {
  const r = setPasswordSchema.safeParse({ password, confirm });
  return r.success ? 'ok' : r.error.issues[0]!.message;
};

test.each([
  ['Ab1', 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร'],
  ['abcdefg1', 'รหัสผ่านต้องมีตัวพิมพ์ใหญ่ (A-Z) อย่างน้อย 1 ตัว'],
  ['ABCDEFG1', 'รหัสผ่านต้องมีตัวพิมพ์เล็ก (a-z) อย่างน้อย 1 ตัว'],
  ['Abcdefgh', 'รหัสผ่านต้องมีตัวเลข (0-9) อย่างน้อย 1 ตัว'],
  ['12345678', 'รหัสผ่านต้องมีตัวพิมพ์ใหญ่ (A-Z) อย่างน้อย 1 ตัว'],
])('%s is refused with the first rule it breaks', (password, message) => {
  expect(check(password)).toBe(message);
});

test.each(['Password1', 'PASSword2024', 'Qwerty123', '123Qwerty', 'Abc12345', 'P@ssw0rd99', 'Admin2024!', 'Helpdesk1'])(
  '%s is refused as too easy to guess',
  (password) => {
    expect(check(password)).toBe('รหัสผ่านต้องไม่ใช่รหัสผ่านที่เดาง่าย เช่น Password1 หรือ Qwerty123');
  },
);

test.each(['Mango7Tree', 'Rq2611ซ่อมแอร์', 'Kittipong1990'])('%s passes every rule', (password) => {
  expect(check(password)).toBe('ok');
});

test('the confirmation must match', () => {
  expect(setPasswordSchema.safeParse({ password: 'Mango7Tree', confirm: 'Mango7Tre' }).error?.issues[0]).toMatchObject({
    path: ['confirm'],
    message: 'รหัสผ่านทั้งสองช่องไม่ตรงกัน',
  });
});
