import { createClient } from 'npm:@supabase/supabase-js@2';
import { handle, type Deps } from './process.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const pushUrl = Deno.env.get('EXPO_PUSH_URL') ?? 'https://exp.host/--/api/v2/push/send';

const must = <T>(r: { data: T; error: unknown }): T => {
  if (r.error) throw r.error;
  return r.data;
};

const deps: Deps = {
  async loadTicket(id) {
    const row = must(await admin.from('tickets').select('id, ticket_no').eq('id', id).maybeSingle());
    return row && { id: row.id, ticketNo: row.ticket_no };
  },
  async listStaffIds() {
    const rows = must(await admin.from('profiles').select('id, role').in('role', ['admin', 'technician']).eq('is_active', true));
    const ids = (role: string) => rows.filter((r) => r.role === role).map((r) => r.id as string);
    return { adminIds: ids('admin'), technicianIds: ids('technician') };
  },
  async getContact(userId) {
    const row = must(await admin.from('profiles').select('expo_push_token, is_active').eq('id', userId).maybeSingle());
    return row?.is_active ? { pushToken: row.expo_push_token } : null;
  },
  async sendPush(to, m) {
    const res = await fetch(pushUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ to, title: m.title, body: m.body, sound: 'default', data: { ticketId: m.ticketId } }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`expo push ${res.status}: ${text}`);
    // Expo answers 200 with a per-message ticket whose status may still be 'error' (e.g. DeviceNotRegistered)
    const tickets = [JSON.parse(text || '{}').data].flat();
    if (tickets.some((t) => t?.status === 'error')) throw new Error(`expo push ticket error: ${text}`);
  },
};

Deno.serve(async (req) => {
  const body: unknown = await req.json().catch(() => null);
  const result = await handle({ secret: req.headers.get('x-webhook-secret'), body }, Deno.env.get('NOTIFY_WEBHOOK_SECRET'), deps);
  return Response.json(result.body, { status: result.status });
});
