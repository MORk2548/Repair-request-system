import { createClient } from 'npm:@supabase/supabase-js@2';
import { handle, type Deps, type Profile } from './handler.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const webBaseUrl = Deno.env.get('WEB_BASE_URL') ?? 'http://localhost:3000';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type ProfileRow = { id: string; display_name: string; role: Profile['role']; department_id: number | null; is_active: boolean };
const PROFILE_COLUMNS = 'id, display_name, role, department_id, is_active';
const toProfile = (r: ProfileRow): Profile => ({
  id: r.id,
  displayName: r.display_name,
  role: r.role,
  departmentId: r.department_id,
  isActive: r.is_active,
});

const must = <T>(r: { data: T; error: unknown }): T => {
  if (r.error) throw r.error;
  return r.data;
};

const deps: Deps = {
  async getCaller(token) {
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) return null;
    const row = must(await admin.from('profiles').select('role, is_active').eq('id', data.user.id).maybeSingle());
    return row && { id: data.user.id, role: row.role, isActive: row.is_active };
  },
  async listUsers() {
    const perPage = 1000;
    const users: { id: string; email: string }[] = [];
    for (let page = 1; ; page++) {
      const batch = must(await admin.auth.admin.listUsers({ page, perPage })).users;
      users.push(...batch.map((u) => ({ id: u.id, email: u.email ?? '' })));
      if (batch.length < perPage) return users;
    }
  },
  async listProfiles() {
    return must(await admin.from('profiles').select(PROFILE_COLUMNS).order('display_name')).map(toProfile);
  },
  async inviteUser(email, redirectTo) {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
    if (error?.code === 'email_exists') return 'email_taken';
    if (error) throw error;
    return { id: data.user.id };
  },
  async upsertProfile(p) {
    const row = { id: p.id, display_name: p.displayName, role: p.role, department_id: p.departmentId };
    return toProfile(must(await admin.from('profiles').upsert(row).select(PROFILE_COLUMNS).single()));
  },
  async updateProfile(userId, patch) {
    const row = {
      ...(patch.displayName !== undefined && { display_name: patch.displayName }),
      ...(patch.role !== undefined && { role: patch.role }),
      ...(patch.departmentId !== undefined && { department_id: patch.departmentId }),
      ...(patch.isActive !== undefined && { is_active: patch.isActive }),
    };
    const found = must(await admin.from('profiles').update(row).eq('id', userId).select(PROFILE_COLUMNS).maybeSingle());
    return found && toProfile(found);
  },
  async setBan(userId, banned) {
    must(await admin.auth.admin.updateUserById(userId, { ban_duration: banned ? '876000h' : 'none' }));
  },
  async deleteUser(userId) {
    must(await admin.auth.admin.deleteUser(userId));
  },
  inviteRedirectTo: `${webBaseUrl}/auth/confirm`,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') || null;
  const body: unknown = await req.json().catch(() => null);
  const result = await handle({ token, body }, deps);
  return Response.json(result.body, { status: result.status, headers: cors });
});
