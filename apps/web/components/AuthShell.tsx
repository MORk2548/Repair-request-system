import type { ThemeId } from '@repair/core';
import type { ReactNode } from 'react';
import { ThemePicker } from './ThemePicker';

export function AuthShell({ theme, children }: { theme: ThemeId; children: ReactNode }) {
  return (
    <div className="auth">
      <main className="login">
        <p className="brand">
          <span className="brand-mark" aria-hidden="true" />
          ระบบแจ้งซ่อม
        </p>
        {children}
        <ThemePicker current={theme} />
      </main>
    </div>
  );
}
