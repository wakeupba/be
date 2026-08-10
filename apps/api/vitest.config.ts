import path from 'node:path';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

/*
 * Tests run inside workerd against a real (in-memory) D1, the same runtime
 * dev and prod use. Migrations are read here and applied once per test file
 * by test/apply-migrations.ts.
 */
export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(__dirname, 'migrations'));

  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            /*
             * No test may send email. The runtime reads .dev.vars, which on a
             * developer machine holds the live Resend key, and the container
             * builds a real notifier whenever that key is present. So any test
             * driving a path that notifies sent actual mail from a real domain:
             * three messages reached the ops inbox before this was fixed, from
             * the demo budget test alone.
             *
             * Empty rather than absent, and set here rather than per file, so a
             * new test cannot opt into a live sender by forgetting. Nothing
             * needs a key: emails.test.ts injects its own EmailService, which is
             * how sending is meant to be asserted.
             */
            RESEND_API_KEY: '',
          },
        },
      }),
    ],
    test: {
      setupFiles: ['./test/apply-migrations.ts'],
    },
  };
});
