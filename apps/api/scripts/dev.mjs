#!/usr/bin/env node
/*
 * Dev entrypoint: wrangler dev plus a local cron pulse. wrangler's
 * --test-scheduled only exposes the manual trigger endpoint; nothing fires
 * on a schedule locally without this. The pulse mirrors production: the
 * call dispatcher every minute, calendar sync every five.
 */
import { spawn } from 'node:child_process';

const ORIGIN = process.env.WRANGLER_DEV_ORIGIN ?? 'http://localhost:8787';
const DISPATCH_CRON = '* * * * *';
const SYNC_CRON = '*/5 * * * *';

const wrangler = spawn('pnpm', ['exec', 'wrangler', 'dev', '--test-scheduled'], { stdio: 'inherit' });

async function fire(cron) {
  try {
    await fetch(`${ORIGIN}/__scheduled?cron=${encodeURIComponent(cron)}`);
  } catch {
    // server restarting or not up yet; the next tick will catch up
  }
}

let tick = 0;
const pulse = setInterval(async () => {
  tick += 1;
  await fire(DISPATCH_CRON);
  if (tick % 5 === 0) await fire(SYNC_CRON);
}, 60_000);

// arm once the worker answers, and run one sync immediately so a freshly
// started dev session sees calendar changes without a five-minute wait
(async () => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${ORIGIN}/health`);
      if (response.ok) {
        console.log('[dev-cron] pulse armed: dispatch every 60s, sync every 300s');
        await fire(SYNC_CRON);
        await fire(DISPATCH_CRON);
        return;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  console.warn('[dev-cron] worker never became healthy; pulse keeps trying every 60s');
})();

function shutdown(signal) {
  clearInterval(pulse);
  wrangler.kill(signal);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
wrangler.on('exit', (code) => {
  clearInterval(pulse);
  process.exit(code ?? 0);
});
