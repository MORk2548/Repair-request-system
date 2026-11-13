import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { SideNav, type NavLink } from './SideNav';

const nav = vi.hoisted(() => ({ path: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.path }));

const LINKS: NavLink[] = [
  { href: '/tickets/new', label: 'แจ้งซ่อม', icon: 'new' },
  { href: '/tickets', label: 'ใบแจ้งซ่อม', icon: 'tickets' },
  { href: '/settings', label: 'ตั้งค่า', icon: 'settings' },
];

const current = () => screen.getAllByRole('link').filter((l) => l.getAttribute('aria-current') === 'page').map((l) => l.textContent);

test.each([
  ['/tickets', ['ใบแจ้งซ่อม']],
  ['/tickets/5eed0000-0000-0000-0000-000000000001', ['ใบแจ้งซ่อม']],
  ['/tickets/new', ['แจ้งซ่อม']],
  ['/settings', ['ตั้งค่า']],
  ['/ticketsx', []],
])('on %s marks %j as the current page', (path, expected) => {
  nav.path = path;
  render(<SideNav links={LINKS} />);
  expect(current()).toEqual(expected);
});
