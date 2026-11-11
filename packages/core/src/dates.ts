import { z } from 'zod';

const bangkokYearMonth = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit' });

export function bangkokMonthRange(now: Date): { from: string; to: string } {
  const p = Object.fromEntries(bangkokYearMonth.formatToParts(now).map((x) => [x.type, x.value]));
  const lastDay = new Date(Date.UTC(Number(p.year), Number(p.month), 0)).getUTCDate();
  return { from: `${p.year}-${p.month}-01`, to: `${p.year}-${p.month}-${lastDay}` };
}

const isRealDate = (s: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).toISOString().startsWith(s);
};
const isoDate = z.string('วันที่ไม่ถูกต้อง').refine(isRealDate, 'วันที่ไม่ถูกต้อง');

export const dateRangeSchema = z
  .object({ from: isoDate, to: isoDate })
  .refine((r) => r.from <= r.to, { message: 'วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด', path: ['from'] });
export type DateRange = z.output<typeof dateRangeSchema>;
