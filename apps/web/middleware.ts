import { createServerClient } from '@supabase/ssr';
import { getProfile, type Database } from '@repair/api';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAnonKey, supabaseUrl } from './lib/env';

const PUBLIC_PATHS = ['/login', '/auth/confirm'];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  let target: string | null = null;
  if (!user) target = PUBLIC_PATHS.includes(path) ? null : '/login';
  else if (path === '/' || path === '/login') target = '/tickets';
  else if ((path === '/admin' || path.startsWith('/admin/')) &&(await getProfile(supabase, user.id))?.role !== 'admin') target = '/tickets';
  if (!target) return response;

  const redirect = NextResponse.redirect(new URL(target, request.url));
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
