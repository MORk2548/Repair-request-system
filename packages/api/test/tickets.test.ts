import { beforeAll, expect, test } from 'vitest';
import {
  AssigneeRequiredError,
  ForbiddenTransitionError,
  ReasonRequiredError,
  ResolutionRequiredError,
  VersionConflictError,
  addComment,
  createTicket,
  getTicket,
  listTickets,
  reassignTicket,
  transitionTicket,
} from '../src/index';
import { newCategory, newUser, service, ticketInput, type TestUser } from './helpers';

let reporter: TestUser, otherReporter: TestUser, tech: TestUser, otherTech: TestUser, admin: TestUser;
let categoryId: number;

beforeAll(async () => {
  [reporter, otherReporter, tech, otherTech, admin] = await Promise.all([
    newUser('reporter'),
    newUser('reporter'),
    newUser('technician'),
    newUser('technician'),
    newUser('admin'),
  ]);
  categoryId = await newCategory();
});

test('createTicket twice with same clientRequestId returns the same ticket', async () => {
  const input = ticketInput(categoryId);
  const a = await createTicket(reporter.db, input);
  const b = await createTicket(reporter.db, input);
  expect(b.id).toBe(a.id);
  expect(a).toMatchObject({ title: input.title, status: 'new', reporterId: reporter.id, version: 1, assigneeId: null });
  expect(a.ticketNo).toMatch(/^RQ-\d{4}-\d{4,}$/);
  expect((await listTickets(reporter.db, {})).items).toHaveLength(1);
});

test('a retried createTicket does not use up a ticket number', async () => {
  const input = ticketInput(categoryId);
  const first = await createTicket(reporter.db, input);
  await createTicket(reporter.db, input);
  const next = await createTicket(reporter.db, ticketInput(categoryId));
  const seq = (t: { ticketNo: string }) => Number(t.ticketNo.split('-')[2]);
  expect(seq(next)).toBe(seq(first) + 1);
});

test('createTicket rejects invalid input with the Thai ZodError', async () => {
  const err = await createTicket(reporter.db, ticketInput(categoryId, { title: '   ' })).catch((e: unknown) => e);
  expect(err).toMatchObject({ name: 'ZodError' });
  expect((err as { issues: { message: string }[] }).issues.map((i) => i.message)).toContain('กรุณากรอกหัวข้อ');
});

test('stale expectedVersion throws VersionConflictError', async () => {
  const { id: ticketId } = await createTicket(reporter.db, ticketInput(categoryId));
  const assigned = await transitionTicket(admin.db, { ticketId, to: 'assigned', expectedVersion: 1, assigneeId: tech.id });
  expect(assigned).toMatchObject({ status: 'assigned', assigneeId: tech.id, version: 2 });
  await expect(transitionTicket(admin.db, { ticketId, to: 'cancelled', expectedVersion: 1 })).rejects.toBeInstanceOf(VersionConflictError);
});

test('transition errors map to their classes', async () => {
  const { id: ticketId } = await createTicket(reporter.db, ticketInput(categoryId));
  await expect(transitionTicket(reporter.db, { ticketId, to: 'assigned', expectedVersion: 1, assigneeId: tech.id })).rejects.toBeInstanceOf(ForbiddenTransitionError);
  await expect(transitionTicket(admin.db, { ticketId, to: 'assigned', expectedVersion: 1 })).rejects.toBeInstanceOf(AssigneeRequiredError);

  await transitionTicket(tech.db, { ticketId, to: 'assigned', expectedVersion: 1, assigneeId: tech.id });
  await transitionTicket(tech.db, { ticketId, to: 'in_progress', expectedVersion: 2 });
  await expect(transitionTicket(tech.db, { ticketId, to: 'done', expectedVersion: 3 })).rejects.toBeInstanceOf(ResolutionRequiredError);
  await expect(transitionTicket(tech.db, { ticketId, to: 'done', expectedVersion: 3, resolution: '   ' })).rejects.toMatchObject({ name: 'ZodError' });
  await expect(reassignTicket(tech.db, { ticketId, expectedVersion: 3, assigneeId: otherTech.id, reason: '  ' })).rejects.toBeInstanceOf(ReasonRequiredError);

  const done = await transitionTicket(tech.db, { ticketId, to: 'done', expectedVersion: 3, resolution: '  เปลี่ยนคอมเพรสเซอร์  ' });
  expect(done).toMatchObject({ status: 'done', resolution: 'เปลี่ยนคอมเพรสเซอร์', version: 4 });
  expect(done.resolvedAt).not.toBeNull();
});

test('reassignTicket hands the ticket to another technician', async () => {
  const { id: ticketId } = await createTicket(reporter.db, ticketInput(categoryId));
  await transitionTicket(tech.db, { ticketId, to: 'assigned', expectedVersion: 1, assigneeId: tech.id });
  const t = await reassignTicket(tech.db, { ticketId, expectedVersion: 2, assigneeId: otherTech.id, reason: 'ไม่มีอะไหล่' });
  expect(t).toMatchObject({ assigneeId: otherTech.id, status: 'assigned', version: 3 });
  const detail = await getTicket(reporter.db, ticketId);
  expect(detail?.events.map((e) => e.action)).toEqual(['created', 'assigned', 'reassigned']);
  expect(detail?.events[2]).toMatchObject({ actorId: tech.id, fromStatus: 'assigned', toStatus: 'assigned', detail: 'ไม่มีอะไหล่' });
});

test("getTicket returns null for another reporter's ticket and for a missing id", async () => {
  const { id } = await createTicket(reporter.db, ticketInput(categoryId));
  expect(await getTicket(otherReporter.db, id)).toBeNull();
  expect(await getTicket(reporter.db, crypto.randomUUID())).toBeNull();
  expect(await getTicket(reporter.db, id)).toMatchObject({ id, photos: [], comments: [] });
});

test('listTickets pages newest first through every row without duplicates', async () => {
  const owner = await newUser('reporter');
  const created: string[] = [];
  for (let i = 0; i < 5; i++) created.push((await createTicket(owner.db, ticketInput(categoryId))).id);

  const seen: string[] = [];
  let cursor: string | undefined;
  let pages = 0;
  do {
    const page = await listTickets(owner.db, { limit: 2, ...(cursor ? { cursor } : {}) });
    seen.push(...page.items.map((t) => t.id));
    cursor = page.nextCursor ?? undefined;
    pages++;
  } while (cursor);

  expect(pages).toBe(3);
  expect(seen).toEqual([...created].reverse());
});

test('listTickets filters by status', async () => {
  const owner = await newUser('reporter');
  const a = await createTicket(owner.db, ticketInput(categoryId));
  await createTicket(owner.db, ticketInput(categoryId));
  await transitionTicket(owner.db, { ticketId: a.id, to: 'cancelled', expectedVersion: 1 });
  const { items, nextCursor } = await listTickets(owner.db, { status: 'cancelled' });
  expect(items.map((t) => t.id)).toEqual([a.id]);
  expect(nextCursor).toBeNull();
});

test('listTickets filters by assignee', async () => {
  const mine = await createTicket(reporter.db, ticketInput(categoryId));
  const theirs = await createTicket(reporter.db, ticketInput(categoryId));
  await transitionTicket(admin.db, { ticketId: mine.id, to: 'assigned', expectedVersion: 1, assigneeId: tech.id });
  await transitionTicket(admin.db, { ticketId: theirs.id, to: 'assigned', expectedVersion: 1, assigneeId: otherTech.id });
  const ids = (await listTickets(admin.db, { assigneeId: tech.id, limit: 100 })).items.map((t) => t.id);
  expect(ids).toContain(mine.id);
  expect(ids).not.toContain(theirs.id);
});

test('getTicket returns the category, equipment and the names of everyone on the ticket', async () => {
  const assetTag = `T7-${crypto.randomUUID().slice(0, 8)}`;
  const { data: eq, error } = await service.from('equipment').insert({ asset_tag: assetTag, name: 'แอร์ห้อง 7' }).select('id').single();
  if (error) throw error;
  const { data: cat } = await service.from('categories').select('name').eq('id', categoryId).single();
  const { id: ticketId } = await createTicket(reporter.db, ticketInput(categoryId, { equipmentId: eq.id }));
  await transitionTicket(admin.db, { ticketId, to: 'assigned', expectedVersion: 1, assigneeId: tech.id });
  await addComment(tech.db, ticketId, 'กำลังไป');

  const detail = await getTicket(reporter.db, ticketId);
  expect(detail).toMatchObject({ categoryName: cat!.name, equipment: { assetTag, name: 'แอร์ห้อง 7' } });
  expect(detail?.people).toEqual({
    [reporter.id]: expect.stringMatching(/^reporter-/),
    [tech.id]: expect.stringMatching(/^technician-/),
    [admin.id]: expect.stringMatching(/^admin-/),
  });
  expect((await getTicket(reporter.db, (await createTicket(reporter.db, ticketInput(categoryId))).id))?.equipment).toBeNull();
});

test('getTicket shows a reporter the names of a deactivated category and retired equipment', async () => {
  const tempCategory = await newCategory();
  const assetTag = `T75-${crypto.randomUUID().slice(0, 8)}`;
  const { data: eq, error } = await service.from('equipment').insert({ asset_tag: assetTag, name: 'เครื่องเก่า' }).select('id').single();
  if (error) throw error;
  const { id: ticketId } = await createTicket(reporter.db, ticketInput(tempCategory, { equipmentId: eq.id }));
  const { data: cat } = await service.from('categories').update({ is_active: false }).eq('id', tempCategory).select('name').single();
  await service.from('equipment').update({ status: 'retired' }).eq('id', eq.id);

  expect(await getTicket(reporter.db, ticketId)).toMatchObject({ categoryName: cat!.name, equipment: { assetTag, name: 'เครื่องเก่า' } });
});

test('getTicket returns null for an id that is not a uuid', async () => {
  expect(await getTicket(reporter.db, 'not-a-uuid')).toBeNull();
});
