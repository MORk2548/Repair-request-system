import { getProfile } from '@repair/api';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { createServerDb } from './supabase-server';

// one auth and profile lookup per request, shared by the signed-in layout and its pages
export const getSession = cache(async () => {
  const db = await createServerDb();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect('/login');
  const profile = await getProfile(db, user.id);
  return { db, user, profile, role: profile?.role ?? 'reporter' };
});
