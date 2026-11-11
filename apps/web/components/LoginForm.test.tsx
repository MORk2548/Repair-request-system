import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { LoginForm } from './LoginForm';

const signInWithPassword = vi.fn();
vi.mock('../lib/supabase-browser', () => ({ createBrowserDb: () => ({ auth: { signInWithPassword } }) }));
const router = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router }));

beforeEach(() => vi.resetAllMocks());

async function signIn(password: string) {
  const user = userEvent.setup();
  render(<LoginForm />);
  await user.type(screen.getByLabelText('อีเมล'), 'admin@helpdesk.test');
  await user.type(screen.getByLabelText('รหัสผ่าน'), password);
  await user.click(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }));
}

test('a failed sign-in shows one message that does not say which field is wrong', async () => {
  signInWithPassword.mockResolvedValue({ data: { user: null, session: null }, error: new Error('Invalid login credentials') });
  await signIn('wrong');

  expect((await screen.findByRole('alert')).textContent).toBe('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
  expect(signInWithPassword).toHaveBeenCalledWith({ email: 'admin@helpdesk.test', password: 'wrong' });
  expect(router.replace).not.toHaveBeenCalled();
});

test('a successful sign-in goes to /tickets', async () => {
  signInWithPassword.mockResolvedValue({ data: {}, error: null });
  await signIn('helpdesk-dev');

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/tickets'));
  expect(screen.queryByRole('alert')).toBeNull();
});
