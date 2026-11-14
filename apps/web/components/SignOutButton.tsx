'use client';

import { useRouter } from 'next/navigation';
import { createBrowserDb } from '../lib/supabase-browser';
import { disablePush } from '../lib/webPush';

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="logout-button"
      onClick={async () => {
        const db = createBrowserDb();
        // a shared computer must stop showing this user's notifications; a failure here must not block signing out
        await disablePush(db).catch(() => {});
        await db.auth.signOut();
        router.replace('/login');
        router.refresh();
      }}
    >
      ออกจากระบบ
    </button>
  );
}
