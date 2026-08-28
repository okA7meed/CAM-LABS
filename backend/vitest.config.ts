import { defineConfig } from 'vitest/config';
import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(rootDir, '.env.test') });

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
