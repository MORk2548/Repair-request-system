import { commentSchema } from '@repair/core';
import type { Db } from './client';
import { throwDbError } from './errors';
import { toComment, type Comment } from './rows';

export async function addComment(db: Db, ticketId: string, body: string): Promise<Comment> {
  const { data, error } = await db
    .from('ticket_comments')
    .insert({ ticket_id: ticketId, body: commentSchema.parse(body) })
    .select()
    .single();
  if (error) throwDbError(error);
  return toComment(data);
}
