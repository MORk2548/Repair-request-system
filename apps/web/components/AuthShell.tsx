import type { ReactNode } from 'react';

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="auth">
      <main className="login">
        <p className="brand">
          <span className="brand-mark" aria-hidden="true" />
          ระบบแจ้งซ่อม
        </p>
        {children}
      </main>
    </div>
  );
}
