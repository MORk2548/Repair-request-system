import Link from 'next/link';
import type { ReactNode } from 'react';
import { SignOutButton } from '../../components/SignOutButton';
import { ThemePicker } from '../../components/ThemePicker';
import { getSession } from '../../lib/session';
import { getThemeId } from '../../lib/theme';

const ADMIN_LINKS = [
  { href: '/admin/users', label: 'ผู้ใช้' },
  { href: '/admin/lists', label: 'แผนกและหมวด' },
  { href: '/admin/equipment', label: 'อุปกรณ์' },
  { href: '/admin/reports', label: 'รายงาน' },
];

export default async function SignedInLayout({ children }: { children: ReactNode }) {
  const [{ user, profile, role }, theme] = await Promise.all([getSession(), getThemeId()]);

  return (
    <>
      <header className="topbar">
        <div className="row">
          <Link href="/tickets" className="brand">
            <span className="brand-mark" aria-hidden="true" />
            ระบบแจ้งซ่อม
          </Link>
          {role === 'admin' && (
            <nav className="row" aria-label="ผู้ดูแลระบบ">
              {ADMIN_LINKS.map((l) => (
                <Link key={l.href} href={l.href}>
                  {l.label}
                </Link>
              ))}
            </nav>
          )}
        </div>
        <div className="row">
          <ThemePicker current={theme} />
          <span>{profile?.displayName ?? user.email}</span>
          <SignOutButton />
        </div>
      </header>
      <main className="page">{children}</main>
    </>
  );
}
