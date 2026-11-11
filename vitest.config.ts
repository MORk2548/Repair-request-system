import { defineConfig } from 'vitest/config';

// the workspace packages run their own suites; the root only covers the Edge Function handlers
export default defineConfig({
  test: { include: ['supabase/functions/**/*.test.ts'] },
});
