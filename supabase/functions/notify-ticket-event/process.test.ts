import { beforeEach, expect, test, vi } from 'vitest';
import { handle, processEvent, type Deps } from './process.ts';

const TICKET = '10000000-0000-4000-8000-000000000001';
const REPORTER = '00000000-0000-4000-8000-00000000000a';
const TECH = '00000000-0000-4000-8000-00000000000c';
const ADMIN = '00000000-0000-4000-8000-00000000000e';
const SECRET = 'webhook-secret';

const tokens: Record<string, string | null> = { [REPORTER]: 'tok-r', [TECH]: 'tok-t', [ADMIN]: null };

let deps: { [K in keyof Deps]: ReturnType<typeof vi.fn<Deps[K]>> };

beforeEach(() => {
  deps = {
    loadTicket: vi.fn(async (id) => ({ id, ticketNo: 'RQ-2611-0001' })),
    listStaffIds: vi.fn(async () => ({ adminIds: [ADMIN], technicianIds: [TECH] })),
    getContact: vi.fn(async (userId) => (userId in tokens ? { pushToken: tokens[userId] ?? null } : null)),
    sendPush: vi.fn(async () => {}),
  };
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const event = (over: Partial<Parameters<typeof processEvent>[0]> = {}) =>
  ({ id: '1', ticketId: TICKET, actorId: ADMIN, toStatus: 'assigned', reporterId: REPORTER, assigneeId: TECH, ...over }) as const;

test('processEvent pushes to every recipient that has a token and skips those without', async () => {
  const r = await processEvent(event({ toStatus: 'done', actorId: TECH }), deps);
  expect(deps.sendPush.mock.calls.map((c) => c[0])).toEqual(['tok-r']);
  expect(r).toEqual({ sent: 1, failed: 0, skipped: 1 });
});

test('a push failure for one recipient does not stop the others', async () => {
  deps.sendPush.mockImplementation(async (token) => {
    if (token === 'tok-t') throw new Error('expo down');
  });
  expect(await processEvent(event(), deps)).toEqual({ sent: 1, failed: 1, skipped: 0 });
  expect(deps.sendPush).toHaveBeenCalledTimes(2);
  expect(console.error).toHaveBeenCalled();
});

test('a recipient whose profile is missing or inactive is skipped', async () => {
  expect(await processEvent(event({ reporterId: 'gone' }), deps)).toEqual({ sent: 1, failed: 0, skipped: 1 });
});

test('recipients come from the people on the event, not from whoever holds the ticket by the time it is processed', async () => {
  await processEvent(event({ actorId: TECH, assigneeId: TECH }), deps);
  expect(deps.sendPush.mock.calls.map((c) => c[0])).toEqual(['tok-r']);
  expect(deps.getContact).not.toHaveBeenCalledWith(ADMIN);
});

test('a missing ticket sends nothing', async () => {
  deps.loadTicket.mockResolvedValue(null);
  expect(await processEvent(event(), deps)).toEqual({ sent: 0, failed: 0, skipped: 0 });
  expect(deps.sendPush).not.toHaveBeenCalled();
});

test('the actor gets no push', async () => {
  await processEvent(event({ toStatus: 'in_progress', actorId: TECH }), deps);
  expect(deps.sendPush.mock.calls.map((c) => c[0])).toEqual(['tok-r']);
});

test('the push carries the Thai message and the ticket id', async () => {
  await processEvent(event(), deps);
  expect(deps.sendPush).toHaveBeenCalledWith('tok-r', {
    title: 'มอบหมายงาน RQ-2611-0001',
    body: 'ใบแจ้งซ่อมได้รับการมอบหมายช่างแล้ว',
    ticketId: TICKET,
  });
});

const row = { id: 9, ticket_id: TICKET, actor_id: ADMIN, action: 'assigned', to_status: 'assigned', reporter_id: REPORTER, assignee_id: TECH };

test('a missing or wrong webhook secret gets 401 and processes nothing', async () => {
  expect((await handle({ secret: null, body: row }, SECRET, deps)).status).toBe(401);
  expect((await handle({ secret: 'webhook-secreT', body: row }, SECRET, deps)).status).toBe(401);
  expect((await handle({ secret: SECRET, body: row }, undefined, deps)).status).toBe(401);
  expect((await handle({ secret: '', body: row }, '', deps)).status).toBe(401);
  expect(deps.loadTicket).not.toHaveBeenCalled();
});

test('an invalid body gets 400', async () => {
  expect((await handle({ secret: SECRET, body: { ...row, ticket_id: 'x' } }, SECRET, deps)).status).toBe(400);
  expect((await handle({ secret: SECRET, body: null }, SECRET, deps)).status).toBe(400);
  expect(deps.loadTicket).not.toHaveBeenCalled();
});

test('an event without a status (a comment) is ignored with 200', async () => {
  expect(await handle({ secret: SECRET, body: { ...row, action: 'comment', to_status: null } }, SECRET, deps)).toEqual({
    status: 200,
    body: { ignored: true },
  });
  expect(deps.loadTicket).not.toHaveBeenCalled();
});

test('a valid event is processed and answers 200 with the counts', async () => {
  expect(await handle({ secret: SECRET, body: row }, SECRET, deps)).toEqual({ status: 200, body: { sent: 2, failed: 0, skipped: 0 } });
  expect(deps.loadTicket).toHaveBeenCalledWith(TICKET);
});
