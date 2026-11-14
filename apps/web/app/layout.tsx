import { THEMES } from '@repair/core';
import type { Metadata } from 'next';
import { Noto_Sans_Thai } from 'next/font/google';
import type { ReactNode } from 'react';
import { Aurora } from '../components/Aurora';
import { AuthWatcher } from '../components/AuthWatcher';
import { getThemeId, themeCss } from '../lib/theme';
import './globals.css';

const font = Noto_Sans_Thai({ subsets: ['thai', 'latin'], display: 'swap' });

export const metadata: Metadata = { title: 'ระบบแจ้งซ่อม' };

const THEME_CSS = themeCss();

export default async function RootLayout({ children }: { children: ReactNode }) {
  const theme = await getThemeId();
  return (
    <html lang="th" data-theme={theme} data-scheme={THEMES[theme].scheme}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: THEME_CSS }} />
      </head>
      <body className={font.className}>
        <Aurora />
        <AuthWatcher />
        {children}
      </body>
    </html>
  );
}
