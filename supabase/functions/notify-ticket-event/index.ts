import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendViaResend } from './email.ts';
import { handle, type Deps } from './process.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const pushUrl = Deno.env.get('EXPO_PUSH_URL') ?? 'https://exp.host/--/api/v2/push/send';
const resendKey = Deno.env.get('RESEND_API_KEY');
const emailFrom = Deno.env.get('EMAIL_FROM');
const resend = { apiUrl: Deno.env.get('RESEND_API_URL'), apiKey: resendKey ?? '', from: emailFrom ?? '' };
const emailEnabled = Boolean(resendKey && emailFrom);

const must = <T>(r: { data: T; error: unknown }): T => {
  if (r.error) throw r.error;
  return r.data;
};

const deps: Deps = {
  async loadTicket(id) {
    const row = must(await admin.from('tickets').select('id, ticket_no, title').eq('id', id).maybeSingle());
    return row && { id: row.id, ticketNo: row.ticket_no, title: row.title };
  },
  async listStaffIds() {
    const rows = must(await admin.from('profiles').select('id, role').in('role', ['admin', 'technician']).eq('is_active', true));
    const ids = (role: string) => rows.filter((r) => r.role === role).map((r) => r.id as string);
    return { adminIds: ids('admin'), technicianIds: ids('technician') };
  },
  async getContact(userId) {
    const row = must(await admin.from('profiles').select('expo_push_token, is_active').eq('id', userId).maybeSingle());
    if (!row?.is_active) return null;
    if (!emailEnabled) return { pushToken: row.expo_push_token, email: null };
    // a failed Auth lookup only loses the email, so the push still goes out
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error) console.error('email lookup', userId, error.message);
    return { pushToken: row.expo_push_token, email: data?.user?.email ?? null };
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
  sendEmail: (to, mail, key) => sendViaResend(fetch, resend, to, mail, key),
  webBaseUrl: Deno.env.get('WEB_BASE_URL') ?? 'http://localhost:3000',
  emailEnabled,
};

Deno.serve(async (req) => {
  const body: unknown = await req.json().catch(() => null);
  const result = await handle({ secret: req.headers.get('x-webhook-secret'), body }, Deno.env.get('NOTIFY_WEBHOOK_SECRET'), deps);
  return Response.json(result.body, { status: result.status });
});
