import { beforeAll, expect, test } from 'vitest';
import { PhotoInvalidError, PhotoLimitError, attachPhoto, createTicket, getTicket } from '../src/index';
import { newCategory, newUser, objectsIn, ticketInput, type TestUser } from './helpers';

let reporter: TestUser, otherReporter: TestUser;
let categoryId: number;

beforeAll(async () => {
  [reporter, otherReporter] = await Promise.all([newUser('reporter'), newUser('reporter')]);
  categoryId = await newCategory();
});

const png = (name = 'photo.png') => {
  const data = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' });
  return { data, mime: 'image/png', size: data.size, name };
};

const newTicket = async (owner = reporter) => (await createTicket(owner.db, ticketInput(categoryId))).id;

test('attached photos come back from getTicket with working signed URLs', async () => {
  const ticketId = await newTicket();
  const { id } = await attachPhoto(reporter.db, ticketId, png('front.png'));
  const detail = await getTicket(reporter.db, ticketId);
  expect(detail?.photos.map((p) => p.id)).toEqual([id]);
  const res = await fetch(detail!.photos[0]!.url);
  expect(res.status).toBe(200);
  expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
});

test('6th photo throws PhotoLimitError without uploading', async () => {
  const ticketId = await newTicket();
  for (let i = 0; i < 5; i++) await attachPhoto(reporter.db, ticketId, png());
  await expect(attachPhoto(reporter.db, ticketId, png())).rejects.toBeInstanceOf(PhotoLimitError);
  expect(await objectsIn(ticketId)).toHaveLength(5);
});

test('6 MB or image/gif photo throws PhotoInvalidError before any upload', async () => {
  const ticketId = await newTicket();
  const tooBig = await attachPhoto(reporter.db, ticketId, { ...png(), size: 6 * 1024 * 1024 }).catch((e: unknown) => e);
  expect(tooBig).toBeInstanceOf(PhotoInvalidError);
  expect((tooBig as PhotoInvalidError).reason).toBe('size');
  const gif = await attachPhoto(reporter.db, ticketId, { ...png(), mime: 'image/gif' }).catch((e: unknown) => e);
  expect(gif).toBeInstanceOf(PhotoInvalidError);
  expect((gif as PhotoInvalidError).reason).toBe('mime');
  expect(await objectsIn(ticketId)).toEqual([]);
});

test("a reporter cannot attach to another reporter's ticket", async () => {
  const ticketId = await newTicket(otherReporter);
  await expect(attachPhoto(reporter.db, ticketId, png())).rejects.toThrow();
  expect(await objectsIn(ticketId)).toEqual([]);
});

test('an upload whose attachment insert fails is removed', async () => {
  const ticketId = await newTicket();
  for (let i = 0; i < 4; i++) await attachPhoto(reporter.db, ticketId, png());
  // both calls count 4 before either inserts, so the second insert hits photo_limit after its upload
  const results = await Promise.allSettled([attachPhoto(reporter.db, ticketId, png()), attachPhoto(reporter.db, ticketId, png())]);
  const rejected = results.filter((r) => r.status === 'rejected');
  expect(rejected).toHaveLength(1);
  expect(rejected[0]!.reason).toBeInstanceOf(PhotoLimitError);
  expect(await objectsIn(ticketId)).toHaveLength(5);
});
