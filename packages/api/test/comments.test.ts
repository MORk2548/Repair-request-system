import { beforeAll, expect, test } from 'vitest';
import { addComment, createTicket, getTicket } from '../src/index';
import { newCategory, newUser, ticketInput, type TestUser } from './helpers';

let reporter: TestUser, otherReporter: TestUser, admin: TestUser;
let ticketId: string;

beforeAll(async () => {
  [reporter, otherReporter, admin] = await Promise.all([newUser('reporter'), newUser('reporter'), newUser('admin')]);
  ticketId = (await createTicket(reporter.db, ticketInput(await newCategory()))).id;
});

test('comments are trimmed and come back oldest first', async () => {
  const first = await addComment(reporter.db, ticketId, '  ยังไม่เย็นครับ  ');
  expect(first).toMatchObject({ ticketId, authorId: reporter.id, body: 'ยังไม่เย็นครับ' });
  const second = await addComment(admin.db, ticketId, 'รับเรื่องแล้ว');
  expect((await getTicket(reporter.db, ticketId))?.comments.map((c) => c.id)).toEqual([first.id, second.id]);
});

test('whitespace-only comment is rejected', async () => {
  await expect(addComment(reporter.db, ticketId, '   ')).rejects.toMatchObject({
    name: 'ZodError',
    issues: [expect.objectContaining({ message: 'กรุณากรอกความคิดเห็น' })],
  });
});

test("a reporter cannot comment on another reporter's ticket", async () => {
  await expect(addComment(otherReporter.db, ticketId, 'แทรก')).rejects.toThrow();
});
