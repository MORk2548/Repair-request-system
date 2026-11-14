import { beforeAll, expect, test } from 'vitest';
import { ForbiddenError, attachPhoto, createTicket, deleteTicket, getTicket } from '../src/index';
import { functionsUrl, newCategory, newUser, objectsIn, service, ticketInput, type TestUser } from './helpers';

let reporter: TestUser, admin: TestUser;
let categoryId: number;

beforeAll(async () => {
  [reporter, admin] = await Promise.all([newUser('reporter'), newUser('admin')]);
  categoryId = await newCategory();
});

const png = () => {
  const data = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' });
  return { data, mime: 'image/png', size: data.size, name: 'photo.png' };
};

const ticketWithPhoto = async () => {
  const { id } = await createTicket(reporter.db, ticketInput(categoryId));
  await attachPhoto(reporter.db, id, png());
  return id;
};

test('only an admin deletes a ticket, and its photo files go with it', async () => {
  const id = await ticketWithPhoto();
  await expect(deleteTicket(reporter.db, id)).rejects.toBeInstanceOf(ForbiddenError);
  expect(await objectsIn(id)).toHaveLength(1);

  await deleteTicket(admin.db, id);
  expect(await getTicket(admin.db, id)).toBeNull();
  expect(await objectsIn(id)).toEqual([]);
});

// needs the purge-photos function served by the local stack (corepack pnpm db:start)
test('purge-photos removes photos of tickets closed over 30 days ago and keeps newer ones', async () => {
  const [old, recent] = await Promise.all([ticketWithPhoto(), ticketWithPhoto()]);
  const closedDaysAgo = async (ticketId: string, days: number) => {
    const res1 = await service.from('tickets').update({ status: 'closed' }).eq('id', ticketId);
    if (res1.error) throw res1.error;
    const at = new Date(Date.now() - days * 86_400_000).toISOString();
    const res2 = await service.from('ticket_events').insert({ ticket_id: ticketId, action: 'status', from_status: 'done', to_status: 'closed', created_at: at });
    if (res2.error) throw res2.error;
  };
  await Promise.all([closedDaysAgo(old, 31), closedDaysAgo(recent, 29)]);

  const denied = await fetch(`${functionsUrl}/purge-photos`, { method: 'POST' });
  expect(denied.status).toBe(401);
  const res = await fetch(`${functionsUrl}/purge-photos`, { method: 'POST', headers: { 'x-webhook-secret': process.env.NOTIFY_WEBHOOK_SECRET ?? 'local-dev-notify-secret' } });
  expect(res.status).toBe(200);

  expect(await objectsIn(old)).toEqual([]);
  expect((await getTicket(admin.db, old))?.photos).toEqual([]);
  expect(await objectsIn(recent)).toHaveLength(1);
  expect((await getTicket(admin.db, recent))?.photos).toHaveLength(1);
});
