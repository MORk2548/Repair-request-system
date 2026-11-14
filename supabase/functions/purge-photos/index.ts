import { createClient } from 'npm:@supabase/supabase-js@2';
import { handle, RETAIN_DAYS, type Deps } from './handler.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const deps: Deps = {
  async listDue(limit) {
    const { data, error } = await admin.rpc('expired_closed_photos', { p_days: RETAIN_DAYS, p_limit: limit });
    if (error) throw error;
    return (data as { id: number; storage_path: string }[]).map((r) => ({ id: r.id, storagePath: r.storage_path }));
  },
  async removeFiles(paths) {
    const { error } = await admin.storage.from('ticket-photos').remove(paths);
    if (error) throw error;
  },
  async deleteRows(ids) {
    const { error } = await admin.from('ticket_attachments').delete().in('id', ids);
    if (error) throw error;
  },
};

Deno.serve(async (req) => {
  const result = await handle(req.headers.get('x-webhook-secret'), Deno.env.get('NOTIFY_WEBHOOK_SECRET'), deps);
  if (result.status === 200) console.log('purge photos', result.body);
  return Response.json(result.body, { status: result.status });
});
