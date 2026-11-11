import type { Email } from '../../../packages/core/src/email.ts';

export type ResendEnv = { apiUrl?: string; apiKey: string; from: string };

export async function sendViaResend(fetchFn: typeof fetch, env: ResendEnv, to: string, mail: Email, idempotencyKey: string): Promise<void> {
  const res = await fetchFn(env.apiUrl ?? 'https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.apiKey}`, 'Idempotency-Key': idempotencyKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.from, to: [to], subject: mail.subject, text: mail.text, html: mail.html }),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
}
