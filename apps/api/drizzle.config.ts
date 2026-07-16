import { defineConfig } from 'drizzle-kit';

// schema is the source of truth; drizzle-kit generates SQL into ./migrations,
// which wrangler d1 migrations apply picks up for both local and remote
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './migrations',
});
