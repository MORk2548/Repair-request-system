import type { Metadata } from 'next';
import { Noto_Sans_Thai } from 'next/font/google';
import type { ReactNode } from 'react';
import { Aurora } from '../components/Aurora';
import './globals.css';

const font = Noto_Sans_Thai({ subsets: ['thai', 'latin'], display: 'swap' });

export const metadata: Metadata = { title: 'ระบบแจ้งซ่อม' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th">
      <body className={font.className}>
        <Aurora />
        {children}
      </body>
    </html>
  );
}
