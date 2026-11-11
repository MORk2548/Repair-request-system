import { getProfile } from '@repair/api';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { SignOutButton } from '../../components/SignOutButton';
import { createServerDb } from '../../lib/supabase-server';

export default async function SignedInLayout({ children }: { children: ReactNode }) {
  const db = await createServerDb();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect('/login');
  const profile = await getProfile(db, user.id);

  return (
    <>
      <header className="topbar">
        <Link href="/tickets" className="brand">
          ระบบแจ้งซ่อม
        </Link>
        <div className="row">
          <span>{profile?.displayName ?? user.email}</span>
          <SignOutButton />
        </div>
      </header>
      <main className="page">{children}</main>
    </>
  );
}
