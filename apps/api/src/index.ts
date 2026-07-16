import { createApp } from './app';
import { buildContainer } from './container';
import type { Env } from './env';

const app = createApp();

const DISPATCH_CRON = '* * * * *';
const SYNC_CRON = '*/5 * * * *';

export default {
  fetch: app.fetch,

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const container = buildContainer(env);
    switch (controller.cron) {
      case DISPATCH_CRON:
        ctx.waitUntil(container.dispatcher.dispatchDue(Date.now()));
        break;
      case SYNC_CRON:
        ctx.waitUntil(container.sync.syncAllUsers());
        break;
      default:
        console.warn(`unknown cron: ${controller.cron}`);
    }
  },
} satisfies ExportedHandler<Env>;
