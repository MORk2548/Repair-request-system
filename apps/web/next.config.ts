import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const config: NextConfig = {
  // both packages ship TypeScript source with no build step
  transpilePackages: ['@repair/core', '@repair/api'],
  // the monorepo root; otherwise Next guesses from any lockfile it finds further up the disk
  outputFileTracingRoot: fileURLToPath(new URL('../..', import.meta.url)),
};

export default config;
