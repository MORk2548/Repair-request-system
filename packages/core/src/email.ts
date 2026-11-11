import { STATUS_LABELS } from './display.ts';
import { messageFor } from './notify.ts';
import type { TicketStatus } from './status.ts';

export type Email = { subject: string; text: string; html: string };

const ENTITIES: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const escapeHtml = (s: string): string => s.replace(/[&<>"']/g, (c) => ENTITIES[c]!);

const FOOTER = 'อีเมลนี้ส่งอัตโนมัติ กรุณาอย่าตอบกลับ';

// takes only id, number and title so a description, photo or comment can never reach an email
export function buildEmail(toStatus: TicketStatus, t: { id: string; ticketNo: string; title: string }, baseUrl: string): Email {
  const m = messageFor(toStatus, t.ticketNo);
  const link = `${baseUrl.replace(/\/+$/, '')}/tickets/${encodeURIComponent(t.id)}`;
  const status = STATUS_LABELS[toStatus];
  const text = [m.body, '', `เลขใบ: ${t.ticketNo}`, `หัวข้อ: ${t.title}`, `สถานะ: ${status}`, '', `ดูใบแจ้งซ่อม: ${link}`, '', FOOTER].join('\n');
  const html = [
    '<!doctype html>',
    '<html lang="th"><head><meta charset="utf-8"></head><body>',
    `<p>${escapeHtml(m.body)}</p>`,
    `<p>เลขใบ: ${escapeHtml(t.ticketNo)}<br>หัวข้อ: ${escapeHtml(t.title)}<br>สถานะ: ${escapeHtml(status)}</p>`,
    `<p><a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p>`,
    `<p>${FOOTER}</p>`,
    '</body></html>',
  ].join('\n');
  return { subject: `[แจ้งซ่อม] ${m.title}`, text, html };
}
