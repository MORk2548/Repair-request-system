import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getSession } from '../../../lib/session';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { role } = await getSession();
  if (role !== 'admin') redirect('/tickets');
  return children;
}
