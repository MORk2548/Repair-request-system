import { buildEmail, type Email } from '../../../packages/core/src/email.ts';
import { messageFor, recipientsFor, ticketEventPayloadSchema, type Staff } from '../../../packages/core/src/notify.ts';
import type { TicketStatus } from '../../../packages/core/src/status.ts';

export type PushMessage = { title: string; body: string; ticketId: string };
export type WebPushSubscription = { endpoint: string; p256dh: string; auth: string };
export type Contact = { pushToken: string | null; email: string | null; webPush: WebPushSubscription[] };

export type Deps = {
  loadTicket(id: string): Promise<{ id: string; ticketNo: string; title: string } | null>;
  listStaffIds(): Promise<Staff>;
  getContact(userId: string): Promise<Contact | null>;
  sendPush(token: string, m: PushMessage): Promise<void>;
  sendEmail(to: string, mail: Email, idempotencyKey: string): Promise<void>;
  sendWebPush(sub: WebPushSubscription, m: PushMessage): Promise<void>;
  // one call per event with every recipient; must ignore rows that already exist so a re-delivered event adds nothing
  saveInbox(eventId: string, userIds: string[]): Promise<void>;
  webBaseUrl: string;
  emailEnabled: boolean;
};

// reporterId and assigneeId are the ticket's people when the event happened; the ticket may have moved on since
export type TicketEvent = { id: string; ticketId: string; actorId: string | null; toStatus: TicketStatus; reporterId: string; assigneeId: string | null };
type ChannelCounts = { sent: number; failed: number; skipped: number };
export type Counts = { push: ChannelCounts; email: ChannelCounts; web: ChannelCounts; inbox: ChannelCounts };
type Outcome = keyof ChannelCounts;
type Outcomes = { push: Outcome; email: Outcome; web: Outcome };

const attempt = (send: () => Promise<void>, what: string): Promise<Outcome> =>
  send().then(
    () => 'sent',
    (e: unknown) => {
      console.error(what, e);
      return 'failed';
    },
  );

async function notifyRecipient(eventId: string, userId: string, push: PushMessage, mail: Email, deps: Deps): Promise<Outcomes> {
  const contact = await deps.getContact(userId);
  const token = contact?.pushToken;
  const to = deps.emailEnabled ? contact?.email : null;
  const subs = contact?.webPush ?? [];
  const [p, e, w] = await Promise.all([
    token ? attempt(() => deps.sendPush(token, push), `push to ${userId}`) : 'skipped',
    // the key is stable per event and recipient, so a re-delivered event cannot email twice
    to ? attempt(() => deps.sendEmail(to, mail, `${eventId}:${userId}`), `email to ${userId}`) : 'skipped',
    // every browser the recipient enabled; one that fails marks the recipient failed without stopping the rest
    subs.length === 0
      ? 'skipped'
      : Promise.all(subs.map((s) => attempt(() => deps.sendWebPush(s, push), `web push to ${userId}`))).then((rs) =>
          rs.includes('failed') ? 'failed' : 'sent',
        ),
  ] as const);
  return { push: p, email: e, web: w };
}

export async function processEvent(e: TicketEvent, deps: Deps): Promise<Counts> {
  const counts: Counts = {
    push: { sent: 0, failed: 0, skipped: 0 },
    email: { sent: 0, failed: 0, skipped: 0 },
    web: { sent: 0, failed: 0, skipped: 0 },
    inbox: { sent: 0, failed: 0, skipped: 0 },
  };
  const ticket = await deps.loadTicket(e.ticketId);
  if (!ticket) return counts;
  const staff = await deps.listStaffIds();
  const push = { ...messageFor(e.toStatus, ticket.ticketNo), ticketId: ticket.id };
  const mail = buildEmail(e.toStatus, ticket, deps.webBaseUrl);
  const recipients = recipientsFor(e, e, staff);
  // the inbox row is independent of push and email: a failure here must not stop them, and the other way round
  const [inbox, results] = await Promise.all([
    recipients.length === 0 ? 'skipped' : attempt(() => deps.saveInbox(e.id, recipients), `inbox for event ${e.id}`),
    Promise.allSettled(recipients.map((id) => notifyRecipient(e.id, id, push, mail, deps))),
  ] as const);
  if (inbox !== 'skipped') counts.inbox[inbox] = recipients.length;
  for (const r of results) {
    if (r.status === 'rejected') console.error('notify recipient', r.reason);
    const o: Outcomes = r.status === 'fulfilled' ? r.value : { push: 'failed', email: 'failed', web: 'failed' };
    counts.push[o.push]++;
    counts.email[o.email]++;
    counts.web[o.web]++;
  }
  return counts;
}

const secretMatches = (given: string, expected: string): boolean => {
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ (b[i] ?? 0);
  return diff === 0;
};

export type Result = { status: number; body: unknown };

export async function handle(
  request: { secret: string | null; body: unknown },
  expectedSecret: string | undefined,
  deps: Deps,
): Promise<Result> {
  if (!expectedSecret || !request.secret || !secretMatches(request.secret, expectedSecret)) {
    return { status: 401, body: { error: 'unauthorized' } };
  }
  const parsed = ticketEventPayloadSchema.safeParse(request.body);
  if (!parsed.success) return { status: 400, body: { error: parsed.error.issues[0]?.message ?? 'invalid body' } };
  const p = parsed.data;
  if (!p.to_status) return { status: 200, body: { ignored: true } };
  try {
    const counts = await processEvent(
      { id: String(p.id), ticketId: p.ticket_id, actorId: p.actor_id, toStatus: p.to_status, reporterId: p.reporter_id, assigneeId: p.assignee_id },
      deps,
    );
    return { status: 200, body: counts };
  } catch (e) {
    console.error('notify event', p.id, e);
    return { status: 500, body: { error: 'notify failed' } };
  }
}
