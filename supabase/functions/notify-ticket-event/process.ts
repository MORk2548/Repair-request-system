import { messageFor, recipientsFor, ticketEventPayloadSchema, type Staff } from '../../../packages/core/src/notify.ts';
import type { TicketStatus } from '../../../packages/core/src/status.ts';

export type PushMessage = { title: string; body: string; ticketId: string };

export type Deps = {
  loadTicket(id: string): Promise<{ id: string; ticketNo: string } | null>;
  listStaffIds(): Promise<Staff>;
  getContact(userId: string): Promise<{ pushToken: string | null } | null>;
  sendPush(token: string, m: PushMessage): Promise<void>;
};

// reporterId and assigneeId are the ticket's people when the event happened; the ticket may have moved on since
export type TicketEvent = { id: string; ticketId: string; actorId: string | null; toStatus: TicketStatus; reporterId: string; assigneeId: string | null };
export type Counts = { sent: number; failed: number; skipped: number };
type Outcome = keyof Counts;

const attempt = (send: () => Promise<void>, what: string): Promise<Outcome> =>
  send().then(
    () => 'sent',
    (e: unknown) => {
      console.error(what, e);
      return 'failed';
    },
  );

// one outcome per channel, so Task 9 adds email beside push here
async function notifyRecipient(userId: string, m: PushMessage, deps: Deps): Promise<Outcome[]> {
  const contact = await deps.getContact(userId);
  const token = contact?.pushToken;
  return Promise.all([token ? attempt(() => deps.sendPush(token, m), `push to ${userId}`) : 'skipped']);
}

export async function processEvent(e: TicketEvent, deps: Deps): Promise<Counts> {
  const counts: Counts = { sent: 0, failed: 0, skipped: 0 };
  const ticket = await deps.loadTicket(e.ticketId);
  if (!ticket) return counts;
  const staff = await deps.listStaffIds();
  const m = { ...messageFor(e.toStatus, ticket.ticketNo), ticketId: ticket.id };
  const results = await Promise.allSettled(recipientsFor(e, e, staff).map((id) => notifyRecipient(id, m, deps)));
  for (const r of results) {
    if (r.status === 'rejected') console.error('notify recipient', r.reason);
    for (const o of r.status === 'fulfilled' ? r.value : ['failed' as const]) counts[o]++;
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
