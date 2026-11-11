import { defineConfig } from 'vitest/config';

export default defineConfig({
  // every file shares the local DB's per-month ticket counter, so files run one at a time
  test: { fileParallelism: false },
});
