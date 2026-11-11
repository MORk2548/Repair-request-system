import { expect, test } from 'vitest';
import { bangkokMonthRange, dateRangeSchema } from '../src/index';

test('a late UTC evening is already the next month in Bangkok', () =>
  expect(bangkokMonthRange(new Date('2026-11-30T17:30:00Z'))).toEqual({ from: '2026-12-01', to: '2026-12-31' }));
test('February of a leap year ends on the 29th', () =>
  expect(bangkokMonthRange(new Date('2028-02-10T00:00:00Z'))).toEqual({ from: '2028-02-01', to: '2028-02-29' }));
test('February of a common year ends on the 28th', () =>
  expect(bangkokMonthRange(new Date('2027-02-28T16:59:59Z'))).toEqual({ from: '2027-02-01', to: '2027-02-28' }));

const message = (r: ReturnType<typeof dateRangeSchema.safeParse>) => (r.success ? null : r.error.issues[0]?.message);

test('accepts a same-day and a normal range', () => {
  expect(dateRangeSchema.parse({ from: '2026-12-01', to: '2026-12-01' })).toEqual({ from: '2026-12-01', to: '2026-12-01' });
  expect(dateRangeSchema.safeParse({ from: '2026-01-01', to: '2026-12-31' }).success).toBe(true);
});
test.each(['2026-02-30', '2026-13-01', '1/2/2026', '', '2026-1-1'])('rejects %s as a date', (bad) =>
  expect(message(dateRangeSchema.safeParse({ from: bad, to: '2026-12-31' }))).toBe('วันที่ไม่ถูกต้อง'));
test('rejects a missing date', () => expect(message(dateRangeSchema.safeParse({ from: '2026-01-01' }))).toBe('วันที่ไม่ถูกต้อง'));
test('rejects from after to', () =>
  expect(message(dateRangeSchema.safeParse({ from: '2026-12-31', to: '2026-01-01' }))).toBe('วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด'));
