import { expect, test } from 'vitest';
import { ROLES, TRANSITIONS, ticketActions, type Role, type TicketStatus } from '../src/index';

const reporter = { id: 'r1', role: 'reporter' as const };
const tech = { id: 't1', role: 'technician' as const };
const admin = { id: 'a1', role: 'admin' as const };

const ticket = (status: TicketStatus, assigneeId: string | null = null) => ({ status, reporterId: 'r1', assigneeId });
const labels = (status: TicketStatus, user: { id: string; role: Role }, assigneeId: string | null = null) =>
  ticketActions(ticket(status, assigneeId), user).map((a) => a.label);

test('reporter on their own done ticket can close or reopen it', () => {
  expect(ticketActions(ticket('done', 't1'), reporter)).toEqual([
    { kind: 'transition', to: 'closed', label: 'ปิดงาน' },
    { kind: 'transition', to: 'in_progress', label: 'ขอแก้ไขใหม่' },
  ]);
});

test("reporter gets nothing on someone else's done ticket", () => {
  expect(labels('done', { id: 'r2', role: 'reporter' }, 't1')).toEqual([]);
});

test('closed and cancelled tickets have no actions for any role', () => {
  for (const status of ['closed', 'cancelled'] as const) {
    for (const role of ROLES) expect(labels(status, { id: role === 'technician' ? 't1' : 'r1', role }, 't1')).toEqual([]);
  }
});

test('technician on a new ticket can only take it', () => {
  expect(ticketActions(ticket('new'), tech)).toEqual([{ kind: 'take', label: 'รับงาน' }]);
});

test('technician who is not the assignee gets nothing on an assigned ticket', () => {
  expect(labels('assigned', tech, 't2')).toEqual([]);
});

test('the assigned technician on an in-progress ticket can finish or hand it over', () => {
  expect(ticketActions(ticket('in_progress', 't1'), tech)).toEqual([
    { kind: 'transition', to: 'done', label: 'เสร็จงาน', needs: 'resolution' },
    { kind: 'reassign', label: 'ส่งต่อช่างคนอื่น' },
  ]);
});

test('admin on a new ticket can assign a technician or cancel', () => {
  expect(ticketActions(ticket('new'), admin)).toEqual([
    { kind: 'transition', to: 'assigned', label: 'มอบหมายช่าง', needs: 'assignee' },
    { kind: 'transition', to: 'cancelled', label: 'ยกเลิกใบแจ้ง' },
  ]);
});

test('admin may hand over any assigned ticket', () => {
  expect(labels('assigned', admin, 't2')).toEqual(['เริ่มงาน', 'ยกเลิกใบแจ้ง', 'ส่งต่อช่างคนอื่น']);
});

test('every transition the table allows has a button label', () => {
  // a technician takes a new ticket through the take action, which has its own label
  for (const t of TRANSITIONS.filter((t) => !(t.role === 'technician' && t.from === 'new'))) {
    const actions = ticketActions({ status: t.from, reporterId: 'u', assigneeId: 'u' }, { id: 'u', role: t.role });
    expect(actions.find((a) => a.kind === 'transition' && a.to === t.to)?.label, `${t.from}>${t.to} ${t.role}`).toBeTruthy();
  }
});
