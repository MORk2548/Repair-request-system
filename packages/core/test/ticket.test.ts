import { test, expect } from 'vitest';
import { commentSchema, createTicketSchema, resolutionSchema } from '../src/index';

const base = { title: 'แอร์ไม่เย็น', description: 'ห้องประชุม 2 แอร์ไม่เย็นตั้งแต่เช้า', categoryId: 3, location: 'ตึก A ชั้น 3', clientRequestId: crypto.randomUUID() };

const messages = (r: { error?: { issues: { message: string }[] } }) => r.error?.issues.map((i) => i.message) ?? [];

test('priority defaults to normal', () => expect(createTicketSchema.parse(base).priority).toBe('normal'));
test('whitespace-only title is rejected', () => expect(createTicketSchema.safeParse({ ...base, title: '   ' }).success).toBe(false));
test('title is trimmed', () => expect(createTicketSchema.parse({ ...base, title: '  แอร์เสีย  ' }).title).toBe('แอร์เสีย'));
test('description counts code points: 2000 ok, 2001 rejected', () => {
  expect(createTicketSchema.safeParse({ ...base, description: '😀'.repeat(2000) }).success).toBe(true);
  expect(createTicketSchema.safeParse({ ...base, description: '😀'.repeat(2001) }).success).toBe(false);
});
test('Thai text with stacked vowels/tone marks is accepted', () => expect(createTicketSchema.safeParse({ ...base, title: 'น้ำรั่วที่ฝ้าเพดาน' }).success).toBe(true));
test('clientRequestId must be a uuid', () => expect(createTicketSchema.safeParse({ ...base, clientRequestId: 'abc' }).success).toBe(false));
test('equipmentId defaults to null; categoryId must be a positive integer', () => {
  expect(createTicketSchema.parse(base).equipmentId).toBeNull();
  expect(createTicketSchema.safeParse({ ...base, categoryId: 0 }).success).toBe(false);
});
test('whitespace-only resolution is rejected', () => expect(resolutionSchema.safeParse('   ').success).toBe(false));

test('whitespace-only title surfaces the Thai required message', () => {
  expect(messages(createTicketSchema.safeParse({ ...base, title: '   ' }))).toContain('กรุณากรอกหัวข้อ');
});
test('2-character Thai title is rejected with the min-length message', () => {
  expect(messages(createTicketSchema.safeParse({ ...base, title: 'ไฟ' }))).toContain('หัวข้อต้องมีอย่างน้อย 3 ตัวอักษร');
});
test('over-long title gets the max-length message', () => {
  expect(messages(createTicketSchema.safeParse({ ...base, title: 'ก'.repeat(101) }))).toContain('หัวข้อยาวได้ไม่เกิน 100 ตัวอักษร');
});
test('missing or invalid categoryId asks to choose a category', () => {
  const { categoryId: _omit, ...rest } = base;
  expect(messages(createTicketSchema.safeParse(rest))).toContain('กรุณาเลือกหมวดหมู่');
  expect(messages(createTicketSchema.safeParse({ ...base, categoryId: 0 }))).toContain('กรุณาเลือกหมวดหมู่');
});
test('empty description, location and resolution show their Thai messages', () => {
  expect(messages(createTicketSchema.safeParse({ ...base, description: ' ' }))).toContain('กรุณากรอกรายละเอียด');
  expect(messages(createTicketSchema.safeParse({ ...base, location: ' ' }))).toContain('กรุณากรอกสถานที่');
  expect(messages(resolutionSchema.safeParse(' '))).toContain('กรุณากรอกวิธีแก้ไข');
});
test('resolution limit is 1000 code points', () => {
  expect(resolutionSchema.safeParse('😀'.repeat(1000)).success).toBe(true);
  expect(messages(resolutionSchema.safeParse('😀'.repeat(1001)))).toContain('วิธีแก้ไขยาวได้ไม่เกิน 1000 ตัวอักษร');
});
test('comment is trimmed, required and at most 1000 code points', () => {
  expect(commentSchema.parse('  ขอบคุณครับ  ')).toBe('ขอบคุณครับ');
  expect(messages(commentSchema.safeParse('   '))).toContain('กรุณากรอกความคิดเห็น');
  expect(commentSchema.safeParse('😀'.repeat(1000)).success).toBe(true);
  expect(messages(commentSchema.safeParse('😀'.repeat(1001)))).toContain('ความคิดเห็นยาวได้ไม่เกิน 1000 ตัวอักษร');
});
