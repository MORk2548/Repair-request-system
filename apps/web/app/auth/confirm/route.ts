import type { EmailOtpType } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';
import { createServerDb } from '../../../lib/supabase-server';

// the invite email links here (supabase/templates/invite.html); verifying the token signs the new user in
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get('token_hash');
  const type = params.get('type') as EmailOtpType | null;
  if (tokenHash && type) {
    const { error } = await (await createServerDb()).auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) redirect('/set-password');
  }
  redirect('/login?error=link');
}
