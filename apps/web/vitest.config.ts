import { defineConfig } from 'vitest/config';

export default defineConfig({
  // tsconfig says jsx: preserve for Next, which would leave JSX untransformed under Vite
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
});
