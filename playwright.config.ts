import { execSync } from 'node:child_process';
import { defineConfig, devices } from '@playwright/test';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
// apps/web/.env.local may point at the cloud project; the smoke test writes tickets and toggles users, so it must stay local
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(supabaseUrl)) {
  throw new Error(`NEXT_PUBLIC_SUPABASE_URL must be the local stack (http://127.0.0.1:54321), not ${supabaseUrl}`);
}

function localAnonKey(): string {
  const status = execSync('corepack pnpm exec supabase status -o env', { encoding: 'utf8' });
  const key = /^ANON_KEY="?([^"\r\n]+)"?/m.exec(status)?.[1];
  if (!key) throw new Error('ANON_KEY not found in `supabase status`; start the local stack with `corepack pnpm db:start`');
  return key;
}

// workers re-load this file; setting it here once lets them inherit the key instead of running `supabase status` again
process.env.SUPABASE_ANON_KEY ??= localAnonKey();

const PORT = 3200;

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/resend-mock.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `corepack pnpm --filter web exec next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
      NEXT_DIST_DIR: '.next-e2e',
    },
  },
});
