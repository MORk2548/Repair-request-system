import type { Metadata } from 'next';
import { Noto_Sans_Thai } from 'next/font/google';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { parsePreferences } from '../lib/preferences';
import './globals.css';

const font = Noto_Sans_Thai({ subsets: ['thai', 'latin'], display: 'swap' });

export const metadata: Metadata = { title: 'ระบบแจ้งซ่อม' };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { theme, font_scale } = parsePreferences(await cookies());
  return (
    <html lang="th" data-theme={theme} data-font-scale={font_scale}>
      <body className={font.className}>{children}</body>
    </html>
  );
}
