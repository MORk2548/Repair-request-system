import { beforeAll, expect, test } from 'vitest';
import { countUnread, createTicket, listNotifications, markNotificationsRead } from '../src/index';
import { newCategory, newUser, service, ticketInput, type TestUser } from './helpers';

let reporter: TestUser, other: TestUser;
let ticketId: string, ticketNo: string;
let eventIds: number[];

beforeAll(async () => {
  [reporter, other] = await Promise.all([newUser('reporter'), newUser('reporter')]);
  const t = await createTicket(reporter.db, ticketInput(await newCategory()));
  ({ id: ticketId, ticketNo } = t);
  // a second event on the same ticket, so there are two notifications to order
  const ev = await service.from('ticket_events').select('id').eq('ticket_id', ticketId);
  const first = ev.data![0]!.id;
  const second = await service.from('ticket_events').insert({ ticket_id: ticketId, actor_id: reporter.id, action: 'status', to_status: 'assigned' }).select('id').single();
  eventIds = [first, second.data!.id];
  const rows = [
    ...eventIds.map((event_id) => ({ user_id: reporter.id, event_id })),
    { user_id: other.id, event_id: first },
  ];
  const res = await service.from('notifications').insert(rows);
  if (res.error) throw res.error;
});

test('lists newest first with the ticket and status joined in', async () => {
  const list = await listNotifications(reporter.db);
  expect(list.map((n) => n.toStatus)).toEqual(['assigned', 'new']);
  expect(list[0]).toMatchObject({ ticketId, ticketNo, title: 'แอร์ไม่เย็น', readAt: null });
});

test('a notification whose ticket the caller cannot see is left out of the list and the count', async () => {
  expect(await listNotifications(other.db)).toEqual([]);
  expect(await countUnread(other.db)).toBe(0);
});

test('reading lowers the count, and another user is untouched', async () => {
  expect(await countUnread(reporter.db)).toBe(2);
  const [newest] = await listNotifications(reporter.db);
  await markNotificationsRead(reporter.db, { ids: [newest!.id] });
  expect(await countUnread(reporter.db)).toBe(1);

  await markNotificationsRead(other.db, { ids: (await listNotifications(reporter.db)).map((n) => n.id) });
  expect(await countUnread(reporter.db)).toBe(1);

  await markNotificationsRead(reporter.db, { ticketId });
  expect(await countUnread(reporter.db)).toBe(0);
  const read = (await listNotifications(reporter.db)).find((n) => n.id === newest!.id);
  expect(read?.readAt).not.toBeNull();
});

test("'all' marks every unread row of the caller", async () => {
  const { error } = await service.from('notifications').update({ read_at: null }).eq('user_id', reporter.id);
  expect(error).toBeNull();
  expect(await countUnread(reporter.db)).toBe(2);
  await markNotificationsRead(reporter.db, 'all');
  expect(await countUnread(reporter.db)).toBe(0);
});
