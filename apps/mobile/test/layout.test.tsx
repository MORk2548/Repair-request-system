import { act, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';
import { db } from '../lib/supabase';
import RootLayout from '../app/_layout';
import Index from '../app/index';
import TabsLayout from '../app/(tabs)/_layout';

jest.mock('../lib/supabase', () => ({ db: { auth: { getSession: jest.fn(), onAuthStateChange: jest.fn(), signOut: jest.fn() } } }));
jest.mock('../lib/env', () => ({ envError: null }));
const mockEnv: { envError: string | null } = jest.requireMock('../lib/env');

beforeEach(() => {
  mockEnv.envError = null;
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

test('signing in moves from the login screen to the ticket list, and signing out moves back', async () => {
  withSession(null);
  await renderRouter(routes, { initialUrl: '/' });
  await screen.findByText('หน้าล็อกอิน');
  const onChange = jest.mocked(db.auth.onAuthStateChange).mock.calls.at(-1)![0];

  await act(() => onChange('SIGNED_IN', { access_token: 'x' } as never));
  expect(await screen.findByText('รายการ')).toBeTruthy();
  await act(() => onChange('SIGNED_OUT', null));
  expect(await screen.findByText('หน้าล็อกอิน')).toBeTruthy();
});

test('signed in opens the ticket list, with a sign-out button', async () => {
  withSession({ access_token: 'x' });
  await renderRouter(routes, { initialUrl: '/' });
  expect(await screen.findByText('รายการ')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'ออกจากระบบ' })).toBeTruthy();
});
