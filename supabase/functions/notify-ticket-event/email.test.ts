import { expect, test, vi } from 'vitest';
import { sendViaResend } from './email.ts';

const mail = { subject: '[แจ้งซ่อม] s', text: 't', html: '<p>h</p>' };
const env = { apiKey: 're_key', from: 'แจ้งซ่อม <no-reply@x.test>' };

test('posts to the Resend API with auth, idempotency key and the message', async () => {
  const fetchFn = vi.fn<typeof fetch>(async () => new Response('{"id":"e1"}', { status: 200 }));
  await sendViaResend(fetchFn, env, 'r@x.test', mail, '9:u1');
  const [url, init] = fetchFn.mock.calls[0]!;
  expect(url).toBe('https://api.resend.com/emails');
  expect(init?.method).toBe('POST');
  expect(init?.headers).toEqual({ Authorization: 'Bearer re_key', 'Idempotency-Key': '9:u1', 'Content-Type': 'application/json' });
  expect(JSON.parse(init?.body as string)).toEqual({ from: env.from, to: ['r@x.test'], ...mail });
});

test('RESEND_API_URL overrides the endpoint', async () => {
  const fetchFn = vi.fn<typeof fetch>(async () => new Response('{}', { status: 200 }));
  await sendViaResend(fetchFn, { ...env, apiUrl: 'http://localhost:8788/emails' }, 'r@x.test', mail, 'k');
  expect(fetchFn.mock.calls[0]![0]).toBe('http://localhost:8788/emails');
});

test('a non-2xx answer throws with the status and response text', async () => {
  const fetchFn = vi.fn<typeof fetch>(async () => new Response('invalid from', { status: 422 }));
  await expect(sendViaResend(fetchFn, env, 'r@x.test', mail, 'k')).rejects.toThrow(/422.*invalid from/);
});
