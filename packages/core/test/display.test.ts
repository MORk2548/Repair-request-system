import { expect, test } from 'vitest';
import { PRIORITIES, PRIORITY_LABELS, STATUS_LABELS, TICKET_STATUSES, formatThaiDateTime } from '../src/index';

test('every status and priority has a Thai label', () => {
  expect(TICKET_STATUSES.map((s) => STATUS_LABELS[s])).toEqual(['ใหม่', 'มอบหมายแล้ว', 'กำลังดำเนินการ', 'แก้ไขเสร็จ', 'ปิดงาน', 'ยกเลิก']);
  expect(PRIORITIES.map((p) => PRIORITY_LABELS[p])).toEqual(['ต่ำ', 'ปกติ', 'ด่วน']);
});

test('formatThaiDateTime shows Bangkok time with a Buddhist-era year', () => {
  expect(formatThaiDateTime('2026-11-30T17:30:00Z')).toBe('01/12/2569 00:30');
  expect(formatThaiDateTime('2027-01-05T02:04:00+00:00')).toBe('05/01/2570 09:04');
});
