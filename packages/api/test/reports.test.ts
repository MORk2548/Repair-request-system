import { beforeAll, expect, test } from 'vitest';
import { ForbiddenError, InvalidRangeError, createTicket, getTicketSummary } from '../src/index';
import { newCategory, newUser, service, ticketInput, type TestUser } from './helpers';

let admin: TestUser, reporter: TestUser, categoryId: number;
// a unique far-future day per run keeps other tests' tickets out of the totals
const day = `${3000 + Math.floor(Math.random() * 6000)}-06-15`;

beforeAll(async () => {
  [admin, reporter] = await Promise.all([newUser('admin'), newUser('reporter')]);
  categoryId = await newCategory();
  const tickets = await Promise.all([createTicket(reporter.db, ticketInput(categoryId)), createTicket(reporter.db, ticketInput(categoryId))]);
  for (const t of tickets) {
    const { error } = await service.from('tickets').update({ created_at: `${day}T05:00:00Z` }).eq('id', t.id);
    if (error) throw error;
  }
});

test('admin gets a camelCase summary of the range', async () => {
  const s = await getTicketSummary(admin.db, { from: day, to: day });
  expect(s.total).toBe(2);
  expect(s.byStatus).toHaveLength(6);
  expect(s.byStatus[0]).toEqual({ status: 'new', count: 2 });
  expect(s.byCategory).toEqual([{ categoryId, name: expect.any(String), count: 2 }]);
  expect(s.byAssignee).toEqual([{ assigneeId: null, name: null, count: 2 }]);
  expect(s.avgResolveHours).toBeNull();
});

test('a reporter is refused', async () => {
  await expect(getTicketSummary(reporter.db, { from: day, to: day })).rejects.toBeInstanceOf(ForbiddenError);
});

test('a reversed range is refused', async () => {
  await expect(getTicketSummary(admin.db, { from: '2026-12-31', to: '2026-01-01' })).rejects.toBeInstanceOf(InvalidRangeError);
});
