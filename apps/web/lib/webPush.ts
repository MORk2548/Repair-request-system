import { deleteWebPushSubscription, saveWebPushSubscription, type Db } from '@repair/api';

export type PushState = 'unsupported' | 'home-screen' | 'denied' | 'off' | 'on';

const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

const supported = () => Boolean(vapidKey) && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const currentSubscription = async () => (await navigator.serviceWorker.getRegistration('/'))?.pushManager.getSubscription() ?? null;

async function save(db: Db, sub: PushSubscription) {
  const { endpoint, keys } = sub.toJSON();
  await saveWebPushSubscription(db, { endpoint: endpoint!, p256dh: keys!.p256dh!, auth: keys!.auth! });
}

export async function readPushState(db: Db): Promise<PushState> {
  if (!supported()) {
    // iOS Safari has no PushManager until the site is opened from the Home Screen
    return /iPhone|iPad|iPod/.test(navigator.userAgent) && Boolean(vapidKey) ? 'home-screen' : 'unsupported';
  }
  if (Notification.permission === 'denied') return 'denied';
  const sub = Notification.permission === 'granted' ? await currentSubscription() : null;
  if (!sub) return 'off';
  // claims the browser for whoever is signed in now, in case the previous user never signed out here
  await save(db, sub);
  return 'on';
}

export async function enablePush(db: Db): Promise<PushState> {
  if ((await Notification.requestPermission()) !== 'granted') return 'denied';
  await navigator.serviceWorker.register('/sw.js');
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKey! }));
  await save(db, sub);
  return 'on';
}

export async function disablePush(db: Db): Promise<void> {
  if (!supported()) return;
  const sub = await currentSubscription();
  if (!sub) return;
  await deleteWebPushSubscription(db, sub.endpoint);
  await sub.unsubscribe();
}
