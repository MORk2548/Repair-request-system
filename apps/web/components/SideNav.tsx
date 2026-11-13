'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ICONS = {
  new: (
    <>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  tickets: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8.5" r="3.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3 20c.7-3.4 3.1-5.3 6-5.3s5.3 1.9 6 5.3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M15.5 5.3a3.5 3.5 0 0 1 0 6.4M17.5 14.9c1.8.7 3 2.4 3.5 5.1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </>
  ),
  lists: (
    <>
      <path d="M4 7.5 12 3l8 4.5-8 4.5-8-4.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="m4 12 8 4.5 8-4.5M4 16.5 12 21l8-4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  equipment: (
    <>
      <rect x="3.5" y="4.5" width="17" height="11.5" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8.5 20h7M12 16v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </>
  ),
  reports: <path d="M4 20h16M7 16.5V11M12 16.5V6M17 16.5v-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />,
};

export type NavLink = { href: string; label: string; icon: keyof typeof ICONS };

export function SideNav({ links }: { links: NavLink[] }) {
  const path = usePathname();
  // the longest matching href wins, so /tickets/new marks "แจ้งซ่อม" and not "ใบแจ้งซ่อม"
  const active = links
    .filter((l) => path === l.href || path.startsWith(`${l.href}/`))
    .reduce<NavLink | undefined>((best, l) => (best && best.href.length >= l.href.length ? best : l), undefined);

  return (
    <nav className="sidebar-nav" aria-label="เมนูหลัก">
      {links.map((l) => (
        <Link key={l.href} href={l.href} aria-current={l === active ? 'page' : undefined}>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            {ICONS[l.icon]}
          </svg>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
