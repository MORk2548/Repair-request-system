import { beforeEach, expect, test, vi } from 'vitest';
import { BATCH, handle, type Deps } from './handler.ts';

const SECRET = 'webhook-secret';
let files: Set<string>;
let rows: Map<number, string>;
let calls: string[];
let deps: { [K in keyof Deps]: ReturnType<typeof vi.fn<Deps[K]>> };

const seed = (n: number) => {
  for (let i = 1; i <= n; i++) {
    rows.set(i, `t/${i}.png`);
    files.add(`t/${i}.png`);
  }
};

beforeEach(() => {
  files = new Set();
  rows = new Map();
  calls = [];
  deps = {
    listDue: vi.fn(async (limit) => [...rows].slice(0, limit).map(([id, storagePath]) => ({ id, storagePath }))),
    removeFiles: vi.fn(async (paths) => {
      calls.push('files');
      for (const p of paths) files.delete(p);
    }),
    deleteRows: vi.fn(async (ids) => {
      calls.push('rows');
      for (const id of ids) rows.delete(id);
    }),
  };
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

test('a missing or wrong secret gets 401 and touches nothing', async () => {
  seed(1);
  expect((await handle(null, SECRET, deps)).status).toBe(401);
  expect((await handle('wrong', SECRET, deps)).status).toBe(401);
  expect((await handle(SECRET, undefined, deps)).status).toBe(401);
  expect(deps.listDue).not.toHaveBeenCalled();
});

test('removes the files before their rows, in batches, until nothing is due', async () => {
  seed(BATCH + 5);
  expect(await handle(SECRET, SECRET, deps)).toEqual({ status: 200, body: { deleted: BATCH + 5, more: false } });
  expect(calls).toEqual(['files', 'rows', 'files', 'rows']);
  expect(files.size).toBe(0);
  expect(rows.size).toBe(0);
});

test('when removing files fails the rows stay, so the next run retries them', async () => {
  seed(3);
  deps.removeFiles.mockRejectedValueOnce(new Error('storage down'));
  expect((await handle(SECRET, SECRET, deps)).status).toBe(500);
  expect(rows.size).toBe(3);
  expect(await handle(SECRET, SECRET, deps)).toEqual({ status: 200, body: { deleted: 3, more: false } });
  expect(rows.size).toBe(0);
});

test('nothing due answers 200 with zero', async () => {
  expect(await handle(SECRET, SECRET, deps)).toEqual({ status: 200, body: { deleted: 0, more: false } });
  expect(deps.removeFiles).not.toHaveBeenCalled();
});
