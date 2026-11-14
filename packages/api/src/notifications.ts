import type { Db } from './client';
import { throwDbError } from './errors';
import { toNotification, type Notification } from './rows';

// !inner drops a notification whose event or ticket the caller can no longer see (RLS hides the joined row)
const VISIBLE = 'id, read_at, ticket_events!inner(ticket_id, to_status, created_at, tickets!inner(ticket_no, title))';

export async function listNotifications(db: Db, { limit = 30 }: { limit?: number } = {}): Promise<Notification[]> {
  const { data, error } = await db.from('notifications').select(VISIBLE).order('id', { ascending: false }).limit(limit);
  if (error) throwDbError(error);
  return data.map(toNotification);
}

export async function countUnread(db: Db): Promise<number> {
  const { count, error } = await db
    .from('notifications')
    .select('id, ticket_events!inner(tickets!inner(id))', { count: 'exact', head: true })
    .is('read_at', null);
  if (error) throwDbError(error);
  return count ?? 0;
}

export type ReadTarget = { ids: number[] } | { ticketId: string } | 'all';

export async function markNotificationsRead(db: Db, target: ReadTarget): Promise<void> {
  let ids: number[] | null = null;
  if (typeof target === 'object' && 'ticketId' in target) {
    const { data, error } = await db
      .from('notifications')
      .select('id, ticket_events!inner(ticket_id)')
      .eq('ticket_events.ticket_id', target.ticketId)
      .is('read_at', null);
    if (error) throwDbError(error);
    ids = data.map((r) => r.id);
  } else if (typeof target === 'object') {
    ids = target.ids;
  }
  if (ids?.length === 0) return;
  let query = db.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null);
  if (ids) query = query.in('id', ids);
  const { error } = await query;
  if (error) throwDbError(error);
}
