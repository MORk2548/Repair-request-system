import { createServerClient } from '@supabase/ssr';
import type { Database, Db } from '@repair/api';
import { cookies } from 'next/headers';
import { supabaseAnonKey, supabaseUrl } from './env';

export async function createServerDb(): Promise<Db> {
  const store = await cookies();
  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // server components cannot set cookies; middleware.ts already refreshed the session
        }
      },
    },
  });
}
