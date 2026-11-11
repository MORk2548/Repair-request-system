import { test, expect } from 'vitest';
import pg from 'pg';
import { TRANSITIONS } from '../src/index';

const key = (t: { from: string; to: string; role: string }) => `${t.from} -> ${t.to} (${t.role})`;

test('status_transitions in the database equals TRANSITIONS', async () => {
  const client = new pg.Client(process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres');
  await client.connect();
  try {
    const { rows } = await client.query<{ from: string; to: string; role: string }>(
      'select from_status::text as "from", to_status::text as "to", role::text as role from public.status_transitions',
    );
    const db = new Set(rows.map(key));
    const core = new Set(TRANSITIONS.map(key));
    expect({
      missing: [...core].filter((k) => !db.has(k)).sort(),
      extra: [...db].filter((k) => !core.has(k)).sort(),
    }).toEqual({ missing: [], extra: [] });
  } finally {
    await client.end();
  }
});
