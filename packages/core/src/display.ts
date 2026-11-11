import type { TicketStatus } from './status';
import type { Priority, TicketEventAction } from './ticket';

export const STATUS_LABELS: Readonly<Record<TicketStatus, string>> = {
  new: 'ใหม่',
  assigned: 'มอบหมายแล้ว',
  in_progress: 'กำลังดำเนินการ',
  done: 'แก้ไขเสร็จ',
  closed: 'ปิดงาน',
  cancelled: 'ยกเลิก',
};

export const PRIORITY_LABELS: Readonly<Record<Priority, string>> = {
  low: 'ต่ำ',
  normal: 'ปกติ',
  urgent: 'ด่วน',
};

export const EVENT_LABELS: Readonly<Record<TicketEventAction, string>> = {
  created: 'แจ้งซ่อม',
  status: 'เปลี่ยนสถานะ',
  assigned: 'มอบหมายงาน',
  reassigned: 'ส่งต่องาน',
  comment: 'แสดงความคิดเห็น',
};

export const eventLabel = (e: { action: TicketEventAction; toStatus: TicketStatus | null }): string =>
  e.action === 'status' && e.toStatus ? STATUS_LABELS[e.toStatus] : EVENT_LABELS[e.action];

const thaiDateTime = new Intl.DateTimeFormat('th-TH-u-ca-buddhist-nu-latn', {
  timeZone: 'Asia/Bangkok',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function formatThaiDateTime(iso: string): string {
  const p = Object.fromEntries(thaiDateTime.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}
