import { expect, test } from 'vitest';
import { messageFor, recipientsFor, ticketEventPayloadSchema, TICKET_STATUSES, type TicketPeople } from '../src/index';

const staff = { adminIds: ['a1', 'a2'], technicianIds: ['t1', 't2'] };
const ticket: TicketPeople = { reporterId: 'r1', assigneeId: 't1' };
const to = (toStatus: (typeof TICKET_STATUSES)[number], actorId: string | null, t = ticket, s = staff) =>
  recipientsFor({ toStatus, actorId }, t, s).sort();

test('new ticket notifies all admins and technicians except the actor', () =>
  expect(recipientsFor({ toStatus: 'new', actorId: 'a1' }, { reporterId: 'r1', assigneeId: null }, { adminIds: ['a1', 'a2'], technicianIds: ['t1'] }).sort()).toEqual(['a2', 't1']));

test('assigned notifies technician and reporter', () =>
  expect(recipientsFor({ toStatus: 'assigned', actorId: 'a1' }, { reporterId: 'r1', assigneeId: 't1' }, { adminIds: ['a1'], technicianIds: ['t1', 't2'] }).sort()).toEqual(['r1', 't1']));

test('technician taking a ticket themself notifies only the reporter', () => expect(to('assigned', 't1')).toEqual(['r1']));

test('reassign by the old technician notifies the new assignee and the reporter', () =>
  expect(to('assigned', 't1', { reporterId: 'r1', assigneeId: 't2' })).toEqual(['r1', 't2']));

test('starting work notifies the reporter', () => expect(to('in_progress', 't1')).toEqual(['r1']));

test('a reporter reopening a done ticket notifies the assignee', () => expect(to('in_progress', 'r1')).toEqual(['t1']));

test('done notifies the reporter and admins', () => expect(to('done', 't1')).toEqual(['a1', 'a2', 'r1']));

test('closed and cancelled notify the assignee and admins', () => {
  expect(to('closed', 'r1')).toEqual(['a1', 'a2', 't1']);
  expect(to('cancelled', 'a1', { reporterId: 'r1', assigneeId: null })).toEqual(['a2']);
});

test('no duplicates when reporter is also admin', () =>
  expect(to('done', 't1', { reporterId: 'a1', assigneeId: 't1' })).toEqual(['a1', 'a2']));

test('actor never notified of own action', () => {
  for (const s of TICKET_STATUSES) expect(to(s, 'a1')).not.toContain('a1');
});

test('a null actor removes nobody and a null assignee is dropped', () => {
  expect(to('closed', null, { reporterId: 'r1', assigneeId: null })).toEqual(['a1', 'a2']);
  expect(to('new', null)).toEqual(['a1', 'a2', 't1', 't2']);
});

test('every status has a Thai message that names the ticket', () => {
  for (const s of TICKET_STATUSES) {
    const m = messageFor(s, 'RQ-2611-0001');
    expect(m.title).toContain('RQ-2611-0001');
    expect(m.body.length).toBeGreaterThan(0);
  }
  expect(messageFor('new', 'RQ-2611-0001').title).toBe('ใบแจ้งซ่อมใหม่ RQ-2611-0001');
});

test('the webhook payload parses a ticket_events row and refuses a bad one', () => {
  const row = { id: 7, ticket_id: '5eed0000-0000-0000-0000-000000000001', actor_id: null, action: 'created', to_status: 'new', reporter_id: '5eed0000-0000-0000-0000-000000000005', assignee_id: null };
  expect(ticketEventPayloadSchema.parse(row)).toEqual({ id: 7, ticket_id: row.ticket_id, actor_id: null, to_status: 'new', reporter_id: row.reporter_id, assignee_id: null });
  expect(ticketEventPayloadSchema.parse({ ...row, action: 'comment', to_status: null }).to_status).toBeNull();
  expect(ticketEventPayloadSchema.safeParse({ ...row, to_status: 'lost' }).success).toBe(false);
  expect(ticketEventPayloadSchema.safeParse({ ...row, ticket_id: 'x' }).success).toBe(false);
});
