import * as Sentry from '@sentry/cloudflare';
import { scrubEvent } from '@wakeupbabe/shared/scrub';
import { createApp } from './app';
import { buildContainer } from './container';
import type { Env } from './env';

const app = createApp();

const DISPATCH_CRON = '* * * * *';
const SYNC_CRON = '*/5 * * * *';

const handler = {
  fetch: app.fetch,

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const container = buildContainer(env);
    switch (controller.cron) {
      case DISPATCH_CRON:
        ctx.waitUntil(container.dispatcher.dispatchDue(Date.now()));
        break;
      case SYNC_CRON:
        ctx.waitUntil(container.sync.syncAllUsers());
        // webhook retries stop within a day; month-old dedup claims and
        // rate-limit slots are dead weight
        ctx.waitUntil(container.webhookEvents.deleteOlderThan(Date.now() - 30 * 24 * 60 * 60 * 1000));
        break;
      default:
        console.warn(`unknown cron: ${controller.cron}`);
    }
  },
} satisfies ExportedHandler<Env>;

/* Sentry instruments fetch and scheduled; without a DSN it stays inert and
 * the handler runs bare. No tracing: this worker's spans are worth less
 * than the quota they'd burn. */
export default Sentry.withSentry(
  (env: Env) =>
    env.SENTRY_DSN
      ? {
          dsn: env.SENTRY_DSN,
          environment: env.API_ORIGIN.includes('localhost') ? 'development' : 'production',
          tracesSampleRate: 0,
          sendDefaultPii: false,
          /* sendDefaultPii only governs what Sentry attaches; exception
           * messages are ours. A Twilio refusal echoes the dialled number in
           * its error body, so phone-shaped digit runs are masked before any
           * event leaves. The privacy page promises exactly this.
           *
           * The parameter is annotated because workers-types also declares an
           * ErrorEvent (the DOM one), and an unannotated callback resolves to
           * it, which quietly breaks withSentry's generic inference. */
          beforeSend: (event: Sentry.ErrorEvent) => scrubEvent(event),
        }
      : undefined,
  handler,
);
