import type { TicketStatus } from '@repair/core';
import { z } from 'zod';
import type { Db } from './client';
import { throwDbError } from './errors';

const summarySchema = z
  .object({
    total: z.number(),
    by_status: z.array(z.object({ status: z.string(), count: z.number() })),
    by_category: z.array(z.object({ category_id: z.number(), name: z.string(), count: z.number() })),
    by_assignee: z.array(z.object({ assignee_id: z.string().nullable(), name: z.string().nullable(), count: z.number() })),
    avg_resolve_hours: z.number().nullable(),
  })
  .transform((r) => ({
    total: r.total,
    byStatus: r.by_status.map((s) => ({ status: s.status as TicketStatus, count: s.count })),
    byCategory: r.by_category.map((c) => ({ categoryId: c.category_id, name: c.name, count: c.count })),
    byAssignee: r.by_assignee.map((a) => ({ assigneeId: a.assignee_id, name: a.name, count: a.count })),
    avgResolveHours: r.avg_resolve_hours,
  }));

export type TicketSummary = z.output<typeof summarySchema>;

export async function getTicketSummary(db: Db, range: { from: string; to: string }): Promise<TicketSummary> {
  const { data, error } = await db.rpc('ticket_summary', { p_from: range.from, p_to: range.to });
  if (error) throwDbError(error);
  return summarySchema.parse(data);
}
