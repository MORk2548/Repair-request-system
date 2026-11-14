import { render } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { AuthWatcher } from './AuthWatcher';

type Listener = (event: string) => void;
let listener: Listener | null = null;
const unsubscribe = vi.fn();
vi.mock('../lib/supabase-browser', () => ({
  createBrowserDb: () => ({
    auth: {
      onAuthStateChange: (cb: Listener) => {
        listener = cb;
        return { data: { subscription: { unsubscribe } } };
      },
    },
  }),
}));
const router = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };
let pathname = '/tickets';
vi.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => pathname }));

const replace = vi.fn();
const realLocation = window.location;

beforeEach(() => {
  vi.clearAllMocks();
  listener = null;
  pathname = '/tickets';
  Object.defineProperty(window, 'location', { configurable: true, value: { ...realLocation, replace } });
});

afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: realLocation });
});

test('signing out (here or in another tab) loads /login fresh, replacing the signed-in page', () => {
  render(<AuthWatcher />);
  listener!('SIGNED_OUT');
  expect(replace).toHaveBeenCalledWith('/login');
});

test('other auth events and a sign-out seen on a public page do nothing', () => {
  render(<AuthWatcher />);
  listener!('TOKEN_REFRESHED');
  listener!('SIGNED_IN');
  pathname = '/login';
  render(<AuthWatcher />);
  listener!('SIGNED_OUT');
  expect(replace).not.toHaveBeenCalled();
});

test('a page restored from the back-forward cache is checked again by the server', () => {
  render(<AuthWatcher />);
  window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: false }));
  expect(router.refresh).not.toHaveBeenCalled();
  window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  expect(router.refresh).toHaveBeenCalledTimes(1);
});

test('stops listening when it unmounts', () => {
  const { unmount } = render(<AuthWatcher />);
  unmount();
  expect(unsubscribe).toHaveBeenCalled();
  window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  expect(router.refresh).not.toHaveBeenCalled();
});
