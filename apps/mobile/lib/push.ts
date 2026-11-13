import { savePushToken, type Db } from '@repair/api';
import { isRunningInExpoGo } from 'expo';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function registerPushToken(db: Db, userId: string): Promise<'registered' | 'denied' | 'unsupported'> {
  const projectId: string | undefined = Constants.expoConfig?.extra?.eas?.projectId ?? process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  // Expo Go on Android has had no remote push since SDK 53, and asking it for a token throws
  if (!Device.isDevice || (Platform.OS === 'android' && isRunningInExpoGo()) || !projectId) return 'unsupported';
  // Android 13+ shows the permission prompt only once a channel exists
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', { name: 'การแจ้งเตือน', importance: Notifications.AndroidImportance.HIGH });
  }
  const current = await Notifications.getPermissionsAsync();
  const { granted } = current.granted ? current : await Notifications.requestPermissionsAsync();
  if (!granted) return 'denied';
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  await savePushToken(db, userId, data);
  return 'registered';
}

// the token goes first so a shared phone stops getting the previous user's notifications; offline, signing out still wins
export async function signOut(db: Db, userId: string | null): Promise<void> {
  try {
    if (userId) await savePushToken(db, userId, null);
  } catch (e) {
    console.warn('clearing the push token failed', e);
  }
  await db.auth.signOut();
}

function openTicket(response: Notifications.NotificationResponse) {
  // cleared so the next sign-in does not open the same ticket again
  void Notifications.clearLastNotificationResponseAsync();
  const id = response.notification.request.content.data?.ticketId;
  if (typeof id === 'string' && GUID.test(id)) router.push(`/tickets/${id}`);
}

// a tap while signed out stays the last response and opens once someone signs in
export function useNotificationTaps(signedIn: boolean) {
  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (live && response) openTicket(response);
    });
    const subscription = Notifications.addNotificationResponseReceivedListener(openTicket);
    return () => {
      live = false;
      subscription.remove();
    };
  }, [signedIn]);
}
