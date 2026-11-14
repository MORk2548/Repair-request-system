import { countUnread } from '@repair/api';
import { ROLE_LABELS } from '@repair/core';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { NotificationBell } from '../../components/NotificationBell';
import { SideNav, type NavLink } from '../../components/SideNav';
import { SignOutButton } from '../../components/SignOutButton';
import { getSession } from '../../lib/session';
import { createServerDb } from '../../lib/supabase-server';

const ADMIN_LINKS: NavLink[] = [
  { href: '/admin/users', label: 'ผู้ใช้', icon: 'users' },
  { href: '/admin/lists', label: 'แผนกและหมวด', icon: 'lists' },
  { href: '/admin/equipment', label: 'อุปกรณ์', icon: 'equipment' },
  { href: '/admin/reports', label: 'รายงาน', icon: 'reports' },
];

export default async function SignedInLayout({ children }: { children: ReactNode }) {
  // the count needs no profile, so it runs beside the session lookup; a failed count only hides the badge
  const [{ user, profile, role }, unread] = await Promise.all([
    getSession(),
    createServerDb().then(countUnread).catch(() => 0),
  ]);
  const name = profile?.displayName ?? user.email ?? '';
  const links: NavLink[] = [
    { href: '/tickets/new', label: 'แจ้งซ่อม', icon: 'new' },
    { href: '/tickets', label: role === 'reporter' ? 'ใบแจ้งซ่อมของฉัน' : 'ใบแจ้งซ่อม', icon: 'tickets' },
    { href: '/notifications', label: 'การแจ้งเตือน', icon: 'bell', badge: unread },
    ...(role === 'admin' ? ADMIN_LINKS : []),
    { href: '/account', label: 'บัญชีของฉัน', icon: 'account' },
    { href: '/settings', label: 'ตั้งค่า', icon: 'settings' },
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="แถบด้านข้าง">
        <Link href="/tickets" className="brand">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M5 12.5 9.2 17 19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span>
            <span className="brand-name">ระบบแจ้งซ่อม</span>
            <span className="brand-caption">แจ้งและติดตามงานซ่อม</span>
          </span>
        </Link>
        <SideNav links={links} />
        <div className="user-chip">
          <span className="avatar" aria-hidden="true">
            {Array.from(name)[0]}
          </span>
          <span className="user-meta">
            <span className="user-name">{name}</span>
            <span className="user-role">{ROLE_LABELS[role]}</span>
          </span>
          <SignOutButton />
        </div>
      </aside>
      <NotificationBell userId={user.id} />
      <main>{children}</main>
    </div>
  );
}
