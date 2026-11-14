import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { SignOutButton } from './SignOutButton';

const signOut = vi.fn();
vi.mock('../lib/supabase-browser', () => ({ createBrowserDb: () => ({ auth: { signOut } }) }));
const router = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const replace = vi.fn();
const realLocation = window.location;

beforeEach(() => {
  vi.clearAllMocks();
  signOut.mockResolvedValue({ error: null });
  Object.defineProperty(window, 'location', { configurable: true, value: { ...realLocation, replace } });
});

afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: realLocation });
});

test('signs out, then loads /login as a new page so no signed-in page stays cached behind the back button', async () => {
  const user = userEvent.setup();
  render(<SignOutButton />);
  await user.click(screen.getByRole('button', { name: 'ออกจากระบบ' }));
  expect(signOut).toHaveBeenCalled();
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
  expect(router.push).not.toHaveBeenCalled();
  expect(router.replace).not.toHaveBeenCalled();
});
