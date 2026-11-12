import { getProfile, savePushToken } from '@repair/api';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';
import { db } from '../lib/supabase';
import RootLayout from '../app/_layout';
import Index from '../app/index';
import TabsLayout from '../app/(tabs)/_layout';

jest.mock('../lib/supabase', () => ({ db: { auth: { getSession: jest.fn(), onAuthStateChange: jest.fn(), signOut: jest.fn() } } }));
jest.mock('../lib/env', () => ({ envError: null }));
jest.mock('@repair/api', () => ({ getProfile: jest.fn(), savePushToken: jest.fn() }));
jest.mock('expo-device', () => ({ isDevice: false }));
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
}));
const mockEnv: { envError: string | null } = jest.requireMock('../lib/env');

const signedIn = { access_token: 'x', user: { id: 'u-1' } };

beforeEach(() => {
  mockEnv.envError = null;
  jest.mocked(getProfile).mockResolvedValue({ id: 'u-1', displayName: 'ณัฐวุฒิ', role: 'reporter' });
  jest.mocked(savePushToken).mockResolvedValue();
});

test('a missing env variable shows its Thai message instead of any screen', async () => {
  mockEnv.envError = 'ตั้งค่าแอปไม่ครบ';
  withSession(null);
  await renderRouter(routes, { initialUrl: '/' });
  expect(await screen.findByText('ตั้งค่าแอปไม่ครบ')).toBeTruthy();
  expect(screen.queryByText('หน้าล็อกอิน')).toBeNull();
});

const routes = {
  _layout: RootLayout,
  index: Index,
  '(tabs)/_layout': TabsLayout,
  '(tabs)/tickets': () => <Text>รายการ</Text>,
  'tickets/new': () => <Text>ฟอร์ม</Text>,
  'tickets/[id]': () => <Text>รายละเอียด</Text>,
  '(auth)/login': () => <Text>หน้าล็อกอิน</Text>,
};

function withSession(session: object | null) {
  jest.mocked(db.auth.getSession).mockResolvedValue({ data: { session }, error: null } as never);
  jest.mocked(db.auth.onAuthStateChange).mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } } as never);
}

test('signed out opens the login screen', async () => {
  withSession(null);
  await renderRouter(routes, { initialUrl: '/' });
  expect(await screen.findByText('หน้าล็อกอิน')).toBeTruthy();
});

test('signed out, a ticket link opens the login screen instead', async () => {
  withSession(null);
  await renderRouter(routes, { initialUrl: '/tickets/t-1' });
  expect(await screen.findByText('หน้าล็อกอิน')).toBeTruthy();
  expect(screen.queryByText('รายละเอียด')).toBeNull();
});

test('signing in moves from the login screen to the ticket list, and signing out moves back', async () => {
  withSession(null);
  await renderRouter(routes, { initialUrl: '/' });
  await screen.findByText('หน้าล็อกอิน');
  const onChange = jest.mocked(db.auth.onAuthStateChange).mock.calls.at(-1)![0];

  await act(() => onChange('SIGNED_IN', signedIn as never));
  expect(await screen.findByText('รายการ')).toBeTruthy();
  await act(() => onChange('SIGNED_OUT', null));
  expect(await screen.findByText('หน้าล็อกอิน')).toBeTruthy();
});

test('signed in opens the ticket list and loads the profile once', async () => {
  withSession(signedIn);
  await renderRouter(routes, { initialUrl: '/' });
  expect(await screen.findByText('รายการ')).toBeTruthy();
  expect(getProfile).toHaveBeenCalledWith(db, 'u-1');
});

test('the sign-out button clears the push token before signing out', async () => {
  withSession(signedIn);
  await renderRouter(routes, { initialUrl: '/' });
  await fireEvent.press(await screen.findByRole('button', { name: 'ออกจากระบบ' }));
  await waitFor(() => expect(db.auth.signOut).toHaveBeenCalled());
  expect(savePushToken).toHaveBeenCalledWith(db, 'u-1', null);
  expect(jest.mocked(savePushToken).mock.invocationCallOrder[0]).toBeLessThan(jest.mocked(db.auth.signOut).mock.invocationCallOrder[0]!);
});
