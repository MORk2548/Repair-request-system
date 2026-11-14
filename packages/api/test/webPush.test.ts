import { randomUUID } from 'node:crypto';
import { beforeAll, expect, test } from 'vitest';
import { deleteWebPushSubscription, saveWebPushSubscription } from '../src/index';
import { newUser, service, type TestUser } from './helpers';

let a: TestUser, b: TestUser;
beforeAll(async () => {
  [a, b] = await Promise.all([newUser('reporter'), newUser('technician')]);
});

const owner = async (endpoint: string) =>
  (await service.from('web_push_subscriptions').select('user_id, p256dh').eq('endpoint', endpoint).maybeSingle()).data;

test('saving a subscription stores it for the caller, and the next user on that browser takes it over', async () => {
  const endpoint = `https://push.test/${randomUUID()}`;
  await saveWebPushSubscription(a.db, { endpoint, p256dh: 'pa', auth: 'aa' });
  expect(await owner(endpoint)).toEqual({ user_id: a.id, p256dh: 'pa' });
  await saveWebPushSubscription(b.db, { endpoint, p256dh: 'pb', auth: 'ab' });
  expect(await owner(endpoint)).toEqual({ user_id: b.id, p256dh: 'pb' });
});

test('a user deletes their own subscription but not someone else\'s', async () => {
  const endpoint = `https://push.test/${randomUUID()}`;
  await saveWebPushSubscription(a.db, { endpoint, p256dh: 'p', auth: 'a' });
  await deleteWebPushSubscription(b.db, endpoint);
  expect(await owner(endpoint)).not.toBeNull();
  await deleteWebPushSubscription(a.db, endpoint);
  expect(await owner(endpoint)).toBeNull();
});
