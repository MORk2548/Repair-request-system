'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

// On phones the menu folds behind a button; on wider screens the button is hidden and the menu is always shown (CSS).
export function SidebarMenu({ unread, children }: { unread: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="menu-toggle"
        aria-expanded={open}
        aria-controls="app-menu"
        aria-label={unread > 0 ? `เมนู มีแจ้งเตือนยังไม่อ่าน ${unread} รายการ` : 'เมนู'}
        onClick={() => setOpen((o) => !o)}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          {open ? (
            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          )}
        </svg>
        {unread > 0 && !open && <span className="menu-dot" aria-hidden="true" />}
      </button>
      <div id="app-menu" className="sidebar-menu" data-open={open}>
        {children}
      </div>
    </>
  );
}
