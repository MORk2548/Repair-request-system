'use client';

import { createBrowserDb } from '../lib/supabase-browser';

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={async () => {
        await createBrowserDb().auth.signOut();
        // a full load drops Next's client cache, so going back reaches the middleware instead of a cached signed-in page
        window.location.replace('/login');
      }}
    >
      ออกจากระบบ
    </button>
  );
}
