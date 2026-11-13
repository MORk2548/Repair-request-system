import { savePushToken } from '@repair/api';
import { renderHook } from '@testing-library/react-native';
import { isRunningInExpoGo } from 'expo';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import { registerPushToken, signOut, useNotificationTaps } from '../lib/push';

jest.mock('@repair/api', () => ({ savePushToken: jest.fn() }));
jest.mock('expo', () => ({ isRunningInExpoGo: jest.fn() }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: { eas: { projectId: 'project-1' } } } } }));
let mockIsDevice = true;
jest.mock('expo-device', () => ({
  get isDevice() {
    return mockIsDevice;
  },
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 6 },
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  getLastNotificationResponseAsync: jest.fn(),
  clearLastNotificationResponseAsync: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
}));

const db = { auth: { signOut: jest.fn() } } as never as Parameters<typeof registerPushToken>[0];
const config = Constants as unknown as { expoConfig: { extra: { eas: { projectId?: string } } } };
const permission = (granted: boolean) => ({ granted, status: granted ? 'granted' : 'denied', canAskAgain: true, expires: 'never' }) as never;
const TICKET = '5eed0000-0000-0000-0000-000000000042';
const tap = (ticketId: unknown) => ({ notification: { request: { content: { data: { ticketId } } } } }) as never;

beforeEach(() => {
  jest.clearAllMocks();
  mockIsDevice = true;
  config.expoConfig.extra.eas.projectId = 'project-1';
  delete process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  jest.replaceProperty(Platform, 'OS', 'ios');
  jest.mocked(isRunningInExpoGo).mockReturnValue(false);
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue(permission(false));
  jest.mocked(Notifications.requestPermissionsAsync).mockResolvedValue(permission(true));
  jest.mocked(Notifications.getExpoPushTokenAsync).mockResolvedValue({ type: 'expo', data: 'ExponentPushToken[abc]' });
  jest.mocked(Notifications.getLastNotificationResponseAsync).mockResolvedValue(null);
  jest.mocked(Notifications.addNotificationResponseReceivedListener).mockReturnValue({ remove: jest.fn() });
});

test('registerPushToken saves the token to profiles for the current user', async () => {
  expect(await registerPushToken(db, 'u-1')).toBe('registered');
  expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'project-1' });
  expect(savePushToken).toHaveBeenCalledWith(db, 'u-1', 'ExponentPushToken[abc]');
});

test('registerPushToken returns "denied" and writes nothing when permission refused', async () => {
  jest.mocked(Notifications.requestPermissionsAsync).mockResolvedValue(permission(false));
  expect(await registerPushToken(db, 'u-1')).toBe('denied');
  expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
  expect(savePushToken).not.toHaveBeenCalled();
});

test('registerPushToken returns "unsupported" on simulator/no device', async () => {
  mockIsDevice = false;
  expect(await registerPushToken(db, 'u-1')).toBe('unsupported');
  expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  expect(savePushToken).not.toHaveBeenCalled();
});

test('registerPushToken returns "unsupported" in Expo Go on Android, which has no remote push', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  jest.mocked(isRunningInExpoGo).mockReturnValue(true);
  expect(await registerPushToken(db, 'u-1')).toBe('unsupported');
  expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
});

test('registerPushToken returns "unsupported" without an EAS project id', async () => {
  delete config.expoConfig.extra.eas.projectId;
  expect(await registerPushToken(db, 'u-1')).toBe('unsupported');
  expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
});

test('the project id may come from EXPO_PUBLIC_EAS_PROJECT_ID', async () => {
  delete config.expoConfig.extra.eas.projectId;
  process.env.EXPO_PUBLIC_EAS_PROJECT_ID = 'project-env';
  expect(await registerPushToken(db, 'u-1')).toBe('registered');
  expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'project-env' });
});

test('on Android the notification channel exists before permission is asked', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  expect(await registerPushToken(db, 'u-1')).toBe('registered');
  const channel = jest.mocked(Notifications.setNotificationChannelAsync).mock.invocationCallOrder[0]!;
  expect(channel).toBeLessThan(jest.mocked(Notifications.requestPermissionsAsync).mock.invocationCallOrder[0]!);
});

test('signOut clears the push token before signing out, and still signs out if clearing fails', async () => {
  await signOut(db, 'u-1');
  expect(savePushToken).toHaveBeenCalledWith(db, 'u-1', null);
  expect(jest.mocked(savePushToken).mock.invocationCallOrder[0]).toBeLessThan(jest.mocked(db.auth.signOut).mock.invocationCallOrder[0]!);

  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.mocked(savePushToken).mockRejectedValueOnce(new Error('offline'));
  await signOut(db, 'u-1');
  expect(db.auth.signOut).toHaveBeenCalledTimes(2);
});

test('a notification tap opens its ticket, from a cold start and while running', async () => {
  jest.mocked(Notifications.getLastNotificationResponseAsync).mockResolvedValue(tap(TICKET));
  renderHook(() => useNotificationTaps(true));
  await new Promise(setImmediate);
  expect(router.push).toHaveBeenCalledWith(`/tickets/${TICKET}`);
  expect(Notifications.clearLastNotificationResponseAsync).toHaveBeenCalled();

  const listener = jest.mocked(Notifications.addNotificationResponseReceivedListener).mock.calls[0]![0];
  listener(tap(TICKET));
  expect(router.push).toHaveBeenCalledTimes(2);
});

test('a notification tap with a non-guid ticketId does not navigate', async () => {
  jest.mocked(Notifications.getLastNotificationResponseAsync).mockResolvedValue(tap('../admin/users'));
  renderHook(() => useNotificationTaps(true));
  await new Promise(setImmediate);
  const listener = jest.mocked(Notifications.addNotificationResponseReceivedListener).mock.calls[0]![0];
  listener(tap(42));
  listener(tap(undefined));
  expect(router.push).not.toHaveBeenCalled();
});

test('notification taps wait until someone is signed in', () => {
  renderHook(() => useNotificationTaps(false));
  expect(Notifications.getLastNotificationResponseAsync).not.toHaveBeenCalled();
  expect(Notifications.addNotificationResponseReceivedListener).not.toHaveBeenCalled();
});
