import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { SidebarMenu } from './SidebarMenu';

const nav = vi.hoisted(() => ({ pathname: '/tickets' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));

const menu = (unread = 0) => (
  <SidebarMenu unread={unread}>
    <a href="/settings">ตั้งค่า</a>
  </SidebarMenu>
);

test('the button opens and closes the menu, and Escape closes it', () => {
  render(menu());
  const button = screen.getByRole('button', { name: 'เมนู' });
  const panel = document.getElementById('app-menu')!;
  expect(button.getAttribute('aria-expanded')).toBe('false');
  expect(panel.dataset.open).toBe('false');
  fireEvent.click(button);
  expect(button.getAttribute('aria-expanded')).toBe('true');
  expect(panel.dataset.open).toBe('true');
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(panel.dataset.open).toBe('false');
});

test('opening another page closes the menu', () => {
  const { rerender } = render(menu());
  fireEvent.click(screen.getByRole('button', { name: 'เมนู' }));
  nav.pathname = '/settings';
  rerender(menu());
  expect(document.getElementById('app-menu')!.dataset.open).toBe('false');
});

test('the closed button tells about unread notifications', () => {
  render(menu(3));
  expect(screen.getByRole('button', { name: 'เมนู มีแจ้งเตือนยังไม่อ่าน 3 รายการ' })).toBeTruthy();
});
