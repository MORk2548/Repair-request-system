import type { EquipmentStatus } from './admin.ts';
import type { Role, TicketStatus } from './status.ts';
import type { Priority, TicketEventAction } from './ticket.ts';

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

export const ROLE_LABELS: Readonly<Record<Role, string>> = {
  reporter: 'ผู้แจ้ง',
  technician: 'ช่าง',
  admin: 'ผู้ดูแลระบบ',
};

export const EQUIPMENT_STATUS_LABELS: Readonly<Record<EquipmentStatus, string>> = {
  active: 'ใช้งาน',
  under_repair: 'กำลังซ่อม',
  retired: 'ปลดระวาง',
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

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const two = (n: number) => String(n).padStart(2, '0');

// computed by hand, not with Intl: Bangkok is UTC+7 all year, and a phone's JS engine may lack the Buddhist calendar
export function formatThaiDateTime(iso: string): string {
  const d = new Date(new Date(iso).getTime() + BANGKOK_OFFSET_MS);
  return `${two(d.getUTCDate())}/${two(d.getUTCMonth() + 1)}/${d.getUTCFullYear() + 543} ${two(d.getUTCHours())}:${two(d.getUTCMinutes())}`;
}
