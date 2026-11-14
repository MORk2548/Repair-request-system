import type { Db } from './client';
import { throwDbError } from './errors';

export type WebPushSubscription = { endpoint: string; p256dh: string; auth: string };

// takes the endpoint over from any other user, because an endpoint is a browser, not a person
export async function saveWebPushSubscription(db: Db, sub: WebPushSubscription): Promise<void> {
  const { error } = await db.rpc('save_web_push_subscription', { p_endpoint: sub.endpoint, p_p256dh: sub.p256dh, p_auth: sub.auth });
  if (error) throwDbError(error);
}

export async function deleteWebPushSubscription(db: Db, endpoint: string): Promise<void> {
  const { error } = await db.from('web_push_subscriptions').delete().eq('endpoint', endpoint);
  if (error) throwDbError(error);
}
