'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { createBrowserDb } from '../lib/supabase-browser';

const PUBLIC_PATHS = ['/login', '/auth/confirm'];

// Back and forward are served from Next's client cache or the browser's back-forward cache without asking the server,
// so the middleware cannot stop a signed-out tab from showing signed-in pages; this does it in the browser.
export function AuthWatcher() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Supabase reports a sign-out in any tab of this browser to every tab
    const { data } = createBrowserDb().auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && !PUBLIC_PATHS.includes(pathname)) window.location.replace('/login');
    });
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) router.refresh();
    };
    window.addEventListener('pageshow', onPageShow);
    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [pathname, router]);

  return null;
}
