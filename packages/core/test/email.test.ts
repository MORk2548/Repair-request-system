import { expect, expectTypeOf, test } from 'vitest';
import { buildEmail, escapeHtml } from '../src/index';

const t = { id: 'abc', ticketNo: 'RQ-2611-0001', title: '<script>alert(1)</script> & "x"' };

test('subject starts with [แจ้งซ่อม] and contains the ticket number', () =>
  expect(buildEmail('assigned', t, 'https://x.test').subject).toMatch(/^\[แจ้งซ่อม\] .*RQ-2611-0001/));

test('html escapes the title but text keeps it raw', () => {
  const m = buildEmail('assigned', t, 'https://x.test');
  expect(m.html).not.toContain('<script>');
  expect(m.html).toContain('&lt;script&gt;');
  expect(m.text).toContain('<script>alert(1)</script>');
});

test('link is {baseUrl}/tickets/{id} with no double slash', () =>
  expect(buildEmail('done', t, 'https://x.test/').html).toContain('https://x.test/tickets/abc'));

test('email never includes description or comments', () => {
  expectTypeOf<Parameters<typeof buildEmail>[1]>().toEqualTypeOf<{ id: string; ticketNo: string; title: string }>();
  const m = buildEmail('done', { ...t, description: 'ความลับ', comments: ['ความเห็น'] } as typeof t, 'https://x.test');
  for (const part of [m.subject, m.text, m.html]) expect(part).not.toMatch(/ความลับ|ความเห็น/);
});

test('escapeHtml escapes all five characters and does not double-escape &', () => {
  expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
  expect(escapeHtml('&lt;')).toBe('&amp;lt;');
});

test('a title with " cannot break out of an attribute', () => {
  const m = buildEmail('new', { ...t, id: 'a"b', title: '" onclick="x' }, 'https://x.test');
  expect(m.html).not.toContain('" onclick');
  expect(m.html).toContain('href="https://x.test/tickets/a%22b"');
});

test('text contains the link exactly once', () => {
  const m = buildEmail('done', t, 'https://x.test');
  expect(m.text.split('https://x.test/tickets/abc').length - 1).toBe(1);
});

test('every trailing slash on baseUrl is trimmed', () => {
  const m = buildEmail('done', t, 'https://x.test///');
  expect(m.text).toContain('https://x.test/tickets/abc');
  expect(m.html).not.toContain('x.test//');
});

test('the body carries the message sentence, ticket number and Thai status label', () => {
  const m = buildEmail('assigned', t, 'https://x.test');
  for (const part of [m.text, m.html]) {
    expect(part).toContain('ใบแจ้งซ่อมได้รับการมอบหมายช่างแล้ว');
    expect(part).toContain('RQ-2611-0001');
    expect(part).toContain('มอบหมายแล้ว');
    expect(part).toContain('อีเมลนี้ส่งอัตโนมัติ กรุณาอย่าตอบกลับ');
  }
  expect(m.html).toContain('lang="th"');
});
