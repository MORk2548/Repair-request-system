import { beforeEach, expect, test, vi } from 'vitest';
import { handle, processEvent, type Deps } from './process.ts';

const TICKET = '10000000-0000-4000-8000-000000000001';
const REPORTER = '00000000-0000-4000-8000-00000000000a';
const TECH = '00000000-0000-4000-8000-00000000000c';
const ADMIN = '00000000-0000-4000-8000-00000000000e';
const SECRET = 'webhook-secret';

const contacts: Record<string, { pushToken: string | null; email: string | null }> = {
  [REPORTER]: { pushToken: 'tok-r', email: 'r@x.test' },
  [TECH]: { pushToken: 'tok-t', email: 't@x.test' },
  [ADMIN]: { pushToken: null, email: 'a@x.test' },
};

type Fn = 'loadTicket' | 'listStaffIds' | 'getContact' | 'sendPush' | 'sendEmail';
let deps: { [K in Fn]: ReturnType<typeof vi.fn<Deps[K]>> } & Pick<Deps, 'webBaseUrl' | 'emailEnabled'>;

beforeEach(() => {
  deps = {
    loadTicket: vi.fn(async (id) => ({ id, ticketNo: 'RQ-2611-0001', title: '<b>จอดับ</b> & "x"' })),
    listStaffIds: vi.fn(async () => ({ adminIds: [ADMIN], technicianIds: [TECH] })),
    getContact: vi.fn(async (userId) => contacts[userId] ?? null),
    sendPush: vi.fn(async () => {}),
    sendEmail: vi.fn(async () => {}),
    webBaseUrl: 'https://web.test/',
    emailEnabled: true,
  };
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const event = (over: Partial<Parameters<typeof processEvent>[0]> = {}) =>
  ({ id: '1', ticketId: TICKET, actorId: ADMIN, toStatus: 'assigned', reporterId: REPORTER, assigneeId: TECH, ...over }) as const;

const counts = (push: [number, number, number], email: [number, number, number]) => ({
  push: { sent: push[0], failed: push[1], skipped: push[2] },
  email: { sent: email[0], failed: email[1], skipped: email[2] },
});

test('processEvent pushes to every recipient that has a token and skips those without', async () => {
  const r = await processEvent(event({ toStatus: 'done', actorId: TECH }), deps);
  expect(deps.sendPush.mock.calls.map((c) => c[0])).toEqual(['tok-r']);
  expect(r.push).toEqual({ sent: 1, failed: 0, skipped: 1 });
});

test('a push failure for one recipient does not stop the others', async () => {
  deps.sendPush.mockImplementation(async (token) => {
    if (token === 'tok-t') throw new Error('expo down');
  });
  expect((await processEvent(event(), deps)).push).toEqual({ sent: 1, failed: 1, skipped: 0 });
  expect(deps.sendPush).toHaveBeenCalledTimes(2);
  expect(console.error).toHaveBeenCalled();
});

test('a recipient whose profile is missing or inactive gets neither channel', async () => {
  expect(await processEvent(event({ reporterId: 'gone' }), deps)).toEqual(counts([1, 0, 1], [1, 0, 1]));
  expect(deps.sendEmail.mock.calls.map((c) => c[0])).toEqual(['t@x.test']);
});

test('recipients come from the people on the event, not from whoever holds the ticket by the time it is processed', async () => {
  await processEvent(event({ actorId: TECH, assigneeId: TECH }), deps);
  expect(deps.sendPush.mock.calls.map((c) => c[0])).toEqual(['tok-r']);
  expect(deps.getContact).not.toHaveBeenCalledWith(ADMIN);
});

test('a missing ticket sends nothing', async () => {
  deps.loadTicket.mockResolvedValue(null);
  expect(await processEvent(event(), deps)).toEqual(counts([0, 0, 0], [0, 0, 0]));
  expect(deps.sendPush).not.toHaveBeenCalled();
  expect(deps.sendEmail).not.toHaveBeenCalled();
});

test('the actor gets no push and no email', async () => {
  await processEvent(event({ toStatus: 'in_progress', actorId: TECH }), deps);
  expect(deps.sendPush.mock.calls.map((c) => c[0])).toEqual(['tok-r']);
  expect(deps.sendEmail.mock.calls.map((c) => c[0])).toEqual(['r@x.test']);
});

test('the push carries the Thai message and the ticket id', async () => {
  await processEvent(event(), deps);
  expect(deps.sendPush).toHaveBeenCalledWith('tok-r', {
    title: 'มอบหมายงาน RQ-2611-0001',
    body: 'ใบแจ้งซ่อมได้รับการมอบหมายช่างแล้ว',
    ticketId: TICKET,
  });
});

test('sends one email per recipient that has an address, with key `${event.id}:${userId}`', async () => {
  await processEvent(event({ id: '42', toStatus: 'done', actorId: TECH }), deps);
  expect(deps.sendEmail.mock.calls.map((c) => [c[0], c[2]]).sort()).toEqual([
    ['a@x.test', `42:${ADMIN}`],
    ['r@x.test', `42:${REPORTER}`],
  ]);
});

test('recipient without email still gets push; recipient without token still gets email', async () => {
  contacts[TECH] = { pushToken: 'tok-t', email: null };
  try {
    const r = await processEvent(event({ toStatus: 'done', actorId: REPORTER, reporterId: TECH }), deps);
    expect(deps.sendPush.mock.calls.map((c) => c[0])).toEqual(['tok-t']);
    expect(deps.sendEmail.mock.calls.map((c) => c[0])).toEqual(['a@x.test']);
    expect(r).toEqual(counts([1, 0, 1], [1, 0, 1]));
  } finally {
    contacts[TECH] = { pushToken: 'tok-t', email: 't@x.test' };
  }
});

test('email failure does not block push and push failure does not block email', async () => {
  deps.sendEmail.mockImplementation(async (to) => {
    if (to === 'r@x.test') throw new Error('resend down');
  });
  deps.sendPush.mockImplementation(async (token) => {
    if (token === 'tok-t') throw new Error('expo down');
  });
  expect(await processEvent(event(), deps)).toEqual(counts([1, 1, 0], [1, 1, 0]));
  expect(deps.sendPush.mock.calls.map((c) => c[0]).sort()).toEqual(['tok-r', 'tok-t']);
  expect(deps.sendEmail.mock.calls.map((c) => c[0]).sort()).toEqual(['r@x.test', 't@x.test']);
});

test('retrying the same event reuses the same idempotency keys', async () => {
  await processEvent(event({ id: '7' }), deps);
  await processEvent(event({ id: '7' }), deps);
  const keys = deps.sendEmail.mock.calls.map((c) => c[2]);
  expect(keys.slice(0, 2).sort()).toEqual(keys.slice(2).sort());
  expect(new Set(keys)).toEqual(new Set([`7:${REPORTER}`, `7:${TECH}`]));
});

test('with email disabled no email is sent and every email counts as skipped', async () => {
  deps.emailEnabled = false;
  expect(await processEvent(event(), deps)).toEqual(counts([2, 0, 0], [0, 0, 2]));
  expect(deps.sendEmail).not.toHaveBeenCalled();
});

test('the email carries the escaped ticket title and the ticket link', async () => {
  await processEvent(event(), deps);
  const mail = deps.sendEmail.mock.calls.find((c) => c[0] === 'r@x.test')![1];
  expect(mail.subject).toBe('[แจ้งซ่อม] มอบหมายงาน RQ-2611-0001');
  expect(mail.html).toContain('&lt;b&gt;จอดับ&lt;/b&gt; &amp; &quot;x&quot;');
  expect(mail.html).not.toContain('<b>จอดับ');
  expect(mail.html).toContain(`https://web.test/tickets/${TICKET}`);
  expect(mail.text).toContain(`https://web.test/tickets/${TICKET}`);
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

test('a valid event is processed and answers 200 with the counts per channel', async () => {
  expect(await handle({ secret: SECRET, body: row }, SECRET, deps)).toEqual({ status: 200, body: counts([2, 0, 0], [2, 0, 0]) });
  expect(deps.loadTicket).toHaveBeenCalledWith(TICKET);
});
