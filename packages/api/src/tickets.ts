import { createTicketSchema, resolutionSchema, type CreateTicketInput, type Ticket, type TicketStatus } from '@repair/core';
import type { Db } from './client';
import type { TablesInsert } from './database.types';
import { throwDbError } from './errors';
import { quote } from './postgrest';
import { toComment, toTicket, toTicketEvent, type TicketDetail } from './rows';

const SIGNED_URL_SECONDS = 3600;

export async function createTicket(db: Db, raw: CreateTicketInput): Promise<Ticket> {
  const input = createTicketSchema.parse(raw);
  const row: Omit<TablesInsert<'tickets'>, 'ticket_no'> = {
    client_request_id: input.clientRequestId,
    title: input.title,
    description: input.description,
    location: input.location,
    category_id: input.categoryId,
    priority: input.priority,
    equipment_id: input.equipmentId,
  };
  // ticket_no has no default because the set_ticket_no trigger fills it, so the generated type wrongly requires it
  const { error } = await db
    .from('tickets')
    .upsert(row as TablesInsert<'tickets'>, { onConflict: 'client_request_id', ignoreDuplicates: true });
  if (error) throwDbError(error);
  const { data, error: selectError } = await db.from('tickets').select().eq('client_request_id', input.clientRequestId).single();
  if (selectError) throwDbError(selectError);
  return toTicket(data);
}

type Cursor = { createdAt: string; id: string };

const encodeCursor = (c: Cursor) => btoa(JSON.stringify(c)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function decodeCursor(s: string): Cursor {
  const c: unknown = JSON.parse(atob(s.replace(/-/g, '+').replace(/_/g, '/')));
  if (typeof c !== 'object' || c === null || !('createdAt' in c) || !('id' in c) || typeof c.createdAt !== 'string' || typeof c.id !== 'string') {
    throw new Error('invalid cursor');
  }
  return { createdAt: c.createdAt, id: c.id };
}

export async function listTickets(
  db: Db,
  { status, limit = 20, cursor }: { status?: TicketStatus; limit?: number; cursor?: string },
): Promise<{ items: Ticket[]; nextCursor: string | null }> {
  let query = db.from('tickets').select().order('created_at', { ascending: false }).order('id', { ascending: false }).limit(limit + 1);
  if (status) query = query.eq('status', status);
  if (cursor) {
    const c = decodeCursor(cursor);
    const at = quote(c.createdAt);
    query = query.or(`created_at.lt.${at},and(created_at.eq.${at},id.lt.${quote(c.id)})`);
  }
  const { data, error } = await query;
  if (error) throwDbError(error);
  const items = data.slice(0, limit).map(toTicket);
  const last = items.at(-1);
  return { items, nextCursor: data.length > limit && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null };
}

export async function getTicket(db: Db, id: string): Promise<TicketDetail | null> {
  const { data, error } = await db
    .from('tickets')
    .select('*, ticket_attachments(id, storage_path, created_at), ticket_comments(*), ticket_events(*)')
    .eq('id', id)
    .order('created_at', { referencedTable: 'ticket_attachments' })
    .order('id', { referencedTable: 'ticket_attachments' })
    .order('created_at', { referencedTable: 'ticket_comments' })
    .order('id', { referencedTable: 'ticket_comments' })
    .order('created_at', { referencedTable: 'ticket_events' })
    .order('id', { referencedTable: 'ticket_events' })
    .maybeSingle();
  if (error) throwDbError(error);
  if (!data) return null;

  const { ticket_attachments: attachments, ticket_comments: comments, ticket_events: events, ...row } = data;
  let urls: string[] = [];
  if (attachments.length > 0) {
    const signed = await db.storage.from('ticket-photos').createSignedUrls(attachments.map((a) => a.storage_path), SIGNED_URL_SECONDS);
    if (signed.error) throwDbError(signed.error);
    urls = signed.data.map((s) => {
      if (!s.signedUrl) throw new Error(s.error ?? `no signed url for ${s.path}`);
      return s.signedUrl;
    });
  }
  return {
    ...toTicket(row),
    photos: attachments.map((a, i) => ({ id: a.id, url: urls[i]! })),
    comments: comments.map(toComment),
    events: events.map(toTicketEvent),
  };
}

export async function transitionTicket(
  db: Db,
  a: { ticketId: string; to: TicketStatus; expectedVersion: number; assigneeId?: string; resolution?: string },
): Promise<Ticket> {
  const { data, error } = await db.rpc('transition_ticket', {
    p_ticket_id: a.ticketId,
    p_to: a.to,
    p_expected_version: a.expectedVersion,
    ...(a.assigneeId !== undefined && { p_assignee: a.assigneeId }),
    ...(a.resolution !== undefined && { p_resolution: resolutionSchema.parse(a.resolution) }),
  });
  if (error) throwDbError(error);
  return toTicket(data);
}

export async function reassignTicket(
  db: Db,
  a: { ticketId: string; expectedVersion: number; assigneeId: string; reason: string },
): Promise<Ticket> {
  const { data, error } = await db.rpc('reassign_ticket', {
    p_ticket_id: a.ticketId,
    p_expected_version: a.expectedVersion,
    p_assignee: a.assigneeId,
    p_reason: a.reason,
  });
  if (error) throwDbError(error);
  return toTicket(data);
}
