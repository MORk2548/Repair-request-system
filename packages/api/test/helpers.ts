import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import type { CreateTicketInput, Role } from '@repair/core';
import type { Db } from '../src/index';
import type { Database } from '../src/database.types';

const env = (() => {
  const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY) {
    return { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, serviceKey: SUPABASE_SERVICE_ROLE_KEY };
  }
  const s = JSON.parse(execSync('corepack pnpm exec supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
  return { url: s.API_URL as string, anonKey: s.ANON_KEY as string, serviceKey: s.SERVICE_ROLE_KEY as string };
})();

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

// tests only: creates users, profiles and lookup rows that no client role may write
export const service: Db = createClient<Database>(env.url, env.serviceKey, noSession);

const must = <R extends { data: unknown; error: unknown }>(r: R): NonNullable<Extract<R, { error: null }>['data']> => {
  if (r.error) throw r.error;
  return r.data as NonNullable<Extract<R, { error: null }>['data']>;
};

export type TestUser = { id: string; email: string; password: string; db: Db };

export async function newUser(role: Role): Promise<TestUser> {
  const email = `${role}-${crypto.randomUUID()}@test.local`;
  // Auth requires upper, lower and a digit (supabase/config.toml password_requirements)
  const password = `Aa1-${crypto.randomUUID()}`;
  const { user } = must(await service.auth.admin.createUser({ email, password, email_confirm: true }));
  must(await service.from('profiles').insert({ id: user.id, display_name: email, role }).select().single());
  const db: Db = createClient<Database>(env.url, env.anonKey, noSession);
  must(await db.auth.signInWithPassword({ email, password }));
  return { id: user.id, email, password, db };
}

export const signIn = (u: Pick<TestUser, 'email' | 'password'>) =>
  createClient<Database>(env.url, env.anonKey, noSession).auth.signInWithPassword({ email: u.email, password: u.password });

export async function newCategory(isActive = true): Promise<number> {
  const name = `cat-${crypto.randomUUID()}`;
  return must(await service.from('categories').insert({ name, is_active: isActive }).select('id').single()).id;
}

export const ticketInput = (categoryId: number, over: Partial<CreateTicketInput> = {}): CreateTicketInput => ({
  title: 'แอร์ไม่เย็น',
  description: 'ห้องประชุม 2 แอร์ไม่เย็น',
  location: 'ตึก A ชั้น 3',
  categoryId,
  priority: 'normal',
  equipmentId: null,
  clientRequestId: crypto.randomUUID(),
  ...over,
});

export const objectsIn = async (ticketId: string): Promise<string[]> =>
  must(await service.storage.from('ticket-photos').list(ticketId)).map((o) => o.name);
