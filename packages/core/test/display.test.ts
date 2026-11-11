import { expect, test } from 'vitest';
import {
  EQUIPMENT_STATUSES,
  EQUIPMENT_STATUS_LABELS,
  PRIORITIES,
  PRIORITY_LABELS,
  ROLES,
  ROLE_LABELS,
  STATUS_LABELS,
  TICKET_STATUSES,
  eventLabel,
  formatThaiDateTime,
} from '../src/index';

test('every status and priority has a Thai label', () => {
  expect(TICKET_STATUSES.map((s) => STATUS_LABELS[s])).toEqual(['ใหม่', 'มอบหมายแล้ว', 'กำลังดำเนินการ', 'แก้ไขเสร็จ', 'ปิดงาน', 'ยกเลิก']);
  expect(PRIORITIES.map((p) => PRIORITY_LABELS[p])).toEqual(['ต่ำ', 'ปกติ', 'ด่วน']);
});

test('every role and equipment status has a Thai label', () => {
  expect(ROLES.map((r) => ROLE_LABELS[r])).toEqual(['ผู้แจ้ง', 'ช่าง', 'ผู้ดูแลระบบ']);
  expect(EQUIPMENT_STATUSES.map((s) => EQUIPMENT_STATUS_LABELS[s])).toEqual(['ใช้งาน', 'กำลังซ่อม', 'ปลดระวาง']);
});

test('formatThaiDateTime shows Bangkok time with a Buddhist-era year', () => {
  expect(formatThaiDateTime('2026-11-30T17:30:00Z')).toBe('01/12/2569 00:30');
  expect(formatThaiDateTime('2027-01-05T02:04:00+00:00')).toBe('05/01/2570 09:04');
});

test('eventLabel names timeline events, using the status label for a status change', () => {
  expect(eventLabel({ action: 'created', toStatus: 'new' })).toBe('แจ้งซ่อม');
  expect(eventLabel({ action: 'assigned', toStatus: 'assigned' })).toBe('มอบหมายงาน');
  expect(eventLabel({ action: 'reassigned', toStatus: 'assigned' })).toBe('ส่งต่องาน');
  expect(eventLabel({ action: 'comment', toStatus: null })).toBe('แสดงความคิดเห็น');
  expect(eventLabel({ action: 'status', toStatus: 'done' })).toBe('แก้ไขเสร็จ');
});
