import { z } from 'zod';

// Words that make a password easy to guess even with case and digits added (Password1, Qwerty123, Admin2024).
const WEAK_BASES = new Set([
  'password', 'passw0rd', 'p@ssw0rd', 'pass', 'qwerty', 'qwertyuiop', 'asdfgh', 'asdfghjkl', 'zxcvbn', 'zxcvbnm',
  'abc', 'abcd', 'abcde', 'abcdef', 'abcdefg', 'abcdefgh', 'aaaaaa', 'aaaaaaaa', 'qazwsx', '1qaz2wsx', 'qwe', 'asd',
  'admin', 'administrator', 'root', 'user', 'test', 'guest', 'login', 'welcome', 'letmein', 'changeme', 'default',
  'iloveyou', 'love', 'monkey', 'dragon', 'master', 'sunshine', 'princess', 'football', 'baseball', 'superman',
  'helpdesk', 'repair', 'thailand', 'bangkok',
]);

// lower-cased with digits and symbols trimmed from both ends, so "Password123!" and "123Qwerty" both reduce to a weak base
const base = (pw: string) => pw.toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g, '');

export type PasswordRule = { label: string; test: (password: string) => boolean };

// One table drives the schema and the live checklist on the form, so they cannot disagree.
export const PASSWORD_RULES: readonly PasswordRule[] = [
  { label: 'ยาวอย่างน้อย 8 ตัวอักษร', test: (p) => p.length >= 8 },
  { label: 'มีตัวพิมพ์ใหญ่ (A-Z) อย่างน้อย 1 ตัว', test: (p) => /[A-Z]/.test(p) },
  { label: 'มีตัวพิมพ์เล็ก (a-z) อย่างน้อย 1 ตัว', test: (p) => /[a-z]/.test(p) },
  { label: 'มีตัวเลข (0-9) อย่างน้อย 1 ตัว', test: (p) => /[0-9]/.test(p) },
  { label: 'ไม่ใช่รหัสผ่านที่เดาง่าย เช่น Password1 หรือ Qwerty123', test: (p) => !WEAK_BASES.has(base(p)) },
];

export const setPasswordSchema = z
  .object({
    password: z
      .string()
      .max(72, 'รหัสผ่านยาวได้ไม่เกิน 72 ตัวอักษร')
      .superRefine((p, ctx) => {
        const broken = PASSWORD_RULES.find((r) => !r.test(p));
        if (broken) ctx.addIssue({ code: 'custom', message: `รหัสผ่านต้อง${broken.label}` });
      }),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: 'รหัสผ่านทั้งสองช่องไม่ตรงกัน', path: ['confirm'] });
