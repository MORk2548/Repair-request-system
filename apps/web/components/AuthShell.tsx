import type { ReactNode } from 'react';

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="guest">
      <div className="panel">
        <div className="eyebrow">ระบบแจ้งซ่อม</div>
        {children}
      </div>
    </main>
  );
}
