import { createServer } from 'node:http';

export const RESEND_MOCK_PORT = 8799;

// Stands in for Resend: notify-ticket-event POSTs to /emails (via host.docker.internal), the spec GETs /emails to read them back.
export default async function globalSetup() {
  const emails: unknown[] = [];
  const server = createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/emails') {
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(emails));
      return;
    }
    if (req.method !== 'POST' || req.url !== '/emails') {
      res.writeHead(404).end();
      return;
    }
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => (body += chunk));
    req.on('end', () => {
      try {
        emails.push(JSON.parse(body));
      } catch {
        res.writeHead(400).end();
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ id: `e2e-${emails.length}` }));
    });
  });
  await new Promise<void>((resolve, reject) => server.once('error', reject).listen(RESEND_MOCK_PORT, '0.0.0.0', resolve));
  return () => new Promise<void>((resolve) => server.close(() => resolve()));
}
