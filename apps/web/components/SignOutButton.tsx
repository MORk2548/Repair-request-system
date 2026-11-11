'use client';

import { useRouter } from 'next/navigation';
import { createBrowserDb } from '../lib/supabase-browser';

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await createBrowserDb().auth.signOut();
        router.replace('/login');
        router.refresh();
      }}
    >
      ออกจากระบบ
    </button>
  );
}
