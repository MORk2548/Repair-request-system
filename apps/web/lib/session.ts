import { getProfile } from '@repair/api';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { createServerDb } from './supabase-server';

// one auth and profile lookup per request, shared by the signed-in layout and its pages
export const getSession = cache(async () => {
  const db = await createServerDb();
  // the middleware already asked the Auth server about this request; the claims are verified against the project's signing keys
  const { data } = await db.auth.getClaims();
  if (!data) redirect('/login');
  const user = { id: data.claims.sub, email: data.claims.email };
  const profile = await getProfile(db, user.id);
  return { db, user, profile, role: profile?.role ?? 'reporter' };
});
