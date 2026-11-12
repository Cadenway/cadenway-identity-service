import { existsSync } from 'node:fs';

import { defineConfig } from 'drizzle-kit';

// drizzle-kit does not read .env by itself; local runs take DATABASE_URL from it when it exists.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

export default defineConfig({
  dialect: 'postgresql',
  // Each module keeps its tables in its own infrastructure layer.
  schema: './src/modules/*/infrastructure/persistence/*.schema.ts',
  out: './migrations',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
});
