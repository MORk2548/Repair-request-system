import { ROLE_LABELS } from '@repair/core';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { SideNav, type NavLink } from '../../components/SideNav';
import { SignOutButton } from '../../components/SignOutButton';
import { getSession } from '../../lib/session';

const ADMIN_LINKS: NavLink[] = [
  { href: '/admin/users', label: 'ผู้ใช้', icon: 'users' },
  { href: '/admin/lists', label: 'แผนกและหมวด', icon: 'lists' },
  { href: '/admin/equipment', label: 'อุปกรณ์', icon: 'equipment' },
  { href: '/admin/reports', label: 'รายงาน', icon: 'reports' },
];

export default async function SignedInLayout({ children }: { children: ReactNode }) {
  const { user, profile, role } = await getSession();
  const name = profile?.displayName ?? user.email ?? '';
  const links: NavLink[] = [
    { href: '/tickets/new', label: 'แจ้งซ่อม', icon: 'new' },
    { href: '/tickets', label: role === 'reporter' ? 'ใบแจ้งซ่อมของฉัน' : 'ใบแจ้งซ่อม', icon: 'tickets' },
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
      <main>{children}</main>
    </div>
  );
}
