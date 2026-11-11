import Link from 'next/link';
import type { ReactNode } from 'react';
import { SignOutButton } from '../../components/SignOutButton';
import { getSession } from '../../lib/session';

export default async function SignedInLayout({ children }: { children: ReactNode }) {
  const { user, profile } = await getSession();

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
