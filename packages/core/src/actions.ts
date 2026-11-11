import { canReassign, nextStatuses, type Role, type TicketStatus } from './status.ts';
import type { Ticket } from './ticket.ts';

export type TicketAction =
  | { kind: 'transition'; to: TicketStatus; label: string; needs?: 'assignee' | 'resolution' }
  | { kind: 'take'; label: 'รับงาน' }
  | { kind: 'reassign'; label: 'ส่งต่อช่างคนอื่น' };

type TransitionAction = Extract<TicketAction, { kind: 'transition' }>;

const TRANSITION_BUTTONS: Partial<Record<`${TicketStatus}>${TicketStatus}`, Pick<TransitionAction, 'label' | 'needs'>>> = {
  'new>assigned': { label: 'มอบหมายช่าง', needs: 'assignee' },
  'new>cancelled': { label: 'ยกเลิกใบแจ้ง' },
  'assigned>in_progress': { label: 'เริ่มงาน' },
  'assigned>cancelled': { label: 'ยกเลิกใบแจ้ง' },
  'in_progress>done': { label: 'เสร็จงาน', needs: 'resolution' },
  'done>closed': { label: 'ปิดงาน' },
  'done>in_progress': { label: 'ขอแก้ไขใหม่' },
};

// mirrors the ownership checks in transition_ticket() and reassign_ticket(); the database still decides
export function ticketActions(
  ticket: Pick<Ticket, 'status' | 'reporterId' | 'assigneeId'>,
  user: { id: string; role: Role },
): TicketAction[] {
  const { status } = ticket;
  const next = nextStatuses(status, user.role);
  if (user.role === 'reporter' && ticket.reporterId !== user.id) return [];
  if (user.role === 'technician' && status === 'new') return next.includes('assigned') ? [{ kind: 'take', label: 'รับงาน' }] : [];
  if (user.role === 'technician' && ticket.assigneeId !== user.id) return [];

  const actions: TicketAction[] = next.map((to) => ({ kind: 'transition', to, ...TRANSITION_BUTTONS[`${status}>${to}`]! }));
  if (canReassign(status, user.role)) actions.push({ kind: 'reassign', label: 'ส่งต่อช่างคนอื่น' });
  return actions;
}
