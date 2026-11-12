import { render, screen, userEvent } from '@testing-library/react-native';
import { db } from '../lib/supabase';
import LoginScreen from '../app/(auth)/login';

jest.mock('../lib/supabase', () => ({ db: { auth: { signInWithPassword: jest.fn() } } }));

test('a failed sign-in shows the Thai message and keeps the email', async () => {
  jest.mocked(db.auth.signInWithPassword).mockResolvedValue({ data: { user: null, session: null }, error: new Error('Invalid login credentials') } as never);
  const user = userEvent.setup();
  await render(<LoginScreen />);

  await user.type(screen.getByLabelText('อีเมล'), 'nattawut@helpdesk.test');
  await user.type(screen.getByLabelText('รหัสผ่าน'), 'wrong');
  await user.press(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }));

  expect(await screen.findByText('อีเมลหรือรหัสผ่านไม่ถูกต้อง')).toBeTruthy();
  expect(db.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'nattawut@helpdesk.test', password: 'wrong' });
  expect(screen.getByLabelText('อีเมล').props.value).toBe('nattawut@helpdesk.test');
});
