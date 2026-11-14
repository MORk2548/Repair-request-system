export type DuePhoto = { id: number; storagePath: string };

export type Deps = {
  listDue(limit: number): Promise<DuePhoto[]>;
  removeFiles(paths: string[]): Promise<void>;
  deleteRows(ids: number[]): Promise<void>;
};

export const RETAIN_DAYS = 30;
export const BATCH = 100;
// a run stops after this many batches; the next daily run picks up the rest
const MAX_BATCHES = 20;

// Files go first: removing a file that is already gone is a no-op, so a run that fails between the two steps
// leaves rows that the next run finds again, never rows that point at missing files without being retried.
export async function purge(deps: Deps): Promise<{ deleted: number; more: boolean }> {
  let deleted = 0;
  for (let i = 0; i < MAX_BATCHES; i++) {
    const due = await deps.listDue(BATCH);
    if (due.length === 0) return { deleted, more: false };
    await deps.removeFiles(due.map((p) => p.storagePath));
    await deps.deleteRows(due.map((p) => p.id));
    deleted += due.length;
    if (due.length < BATCH) return { deleted, more: false };
  }
  return { deleted, more: true };
}

const secretMatches = (given: string, expected: string): boolean => {
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ (b[i] ?? 0);
  return diff === 0;
};

export async function handle(secret: string | null, expectedSecret: string | undefined, deps: Deps): Promise<{ status: number; body: unknown }> {
  if (!expectedSecret || !secret || !secretMatches(secret, expectedSecret)) return { status: 401, body: { error: 'unauthorized' } };
  try {
    return { status: 200, body: await purge(deps) };
  } catch (e) {
    console.error('purge photos', e);
    return { status: 500, body: { error: 'purge failed' } };
  }
}
