import { z } from 'zod';
import { TICKET_STATUSES, type TicketStatus } from './status.ts';

export type Staff = { adminIds: string[]; technicianIds: string[] };
export type TicketPeople = { reporterId: string; assigneeId: string | null };
export type NotifyMessage = { title: string; body: string };

// the assignee is on in_progress so a reporter's reopen (done -> in_progress) reaches the technician
const RECIPIENTS: Readonly<Record<TicketStatus, (t: TicketPeople, s: Staff) => (string | null)[]>> = {
  new: (_, s) => [...s.adminIds, ...s.technicianIds],
  assigned: (t) => [t.assigneeId, t.reporterId],
  in_progress: (t) => [t.reporterId, t.assigneeId],
  done: (t, s) => [t.reporterId, ...s.adminIds],
  closed: (t, s) => [t.assigneeId, ...s.adminIds],
  cancelled: (t, s) => [t.assigneeId, ...s.adminIds],
};

export const recipientsFor = (
  e: { toStatus: TicketStatus; actorId: string | null },
  t: TicketPeople,
  staff: Staff,
): string[] =>
  [...new Set(RECIPIENTS[e.toStatus](t, staff))].filter((id): id is string => id !== null && id !== e.actorId);

const MESSAGES: Readonly<Record<TicketStatus, NotifyMessage>> = {
  new: { title: 'ใบแจ้งซ่อมใหม่', body: 'มีใบแจ้งซ่อมใหม่รอรับงาน' },
  assigned: { title: 'มอบหมายงาน', body: 'ใบแจ้งซ่อมได้รับการมอบหมายช่างแล้ว' },
  in_progress: { title: 'เริ่มดำเนินการ', body: 'ใบแจ้งซ่อมอยู่ระหว่างดำเนินการแก้ไข' },
  done: { title: 'แก้ไขเสร็จ', body: 'ช่างแก้ไขเสร็จแล้ว กรุณาตรวจสอบและปิดงาน' },
  closed: { title: 'ปิดงาน', body: 'ใบแจ้งซ่อมนี้ปิดงานแล้ว' },
  cancelled: { title: 'ยกเลิกใบแจ้ง', body: 'ใบแจ้งซ่อมนี้ถูกยกเลิกแล้ว' },
};

export const messageFor = (toStatus: TicketStatus, ticketNo: string): NotifyMessage => ({
  title: `${MESSAGES[toStatus].title} ${ticketNo}`,
  body: MESSAGES[toStatus].body,
});

// the body notify_ticket_event() (0007_notify.sql) posts for each ticket_events row
export const ticketEventPayloadSchema = z.object({
  id: z.int(),
  ticket_id: z.guid(),
  actor_id: z.guid().nullable(),
  to_status: z.enum(TICKET_STATUSES).nullable(),
  reporter_id: z.guid(),
  assignee_id: z.guid().nullable(),
});
export type TicketEventPayload = z.infer<typeof ticketEventPayloadSchema>;
