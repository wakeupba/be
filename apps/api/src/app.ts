import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createMiddleware } from 'hono/factory';
import { secureHeaders } from 'hono/secure-headers';
import { buildContainer, type Container } from './container';
import type { Env } from './env';
import { readSession } from './lib/session';
import { authRoutes } from './routes/auth';
import { dodoRoutes, plivoRoutes } from './routes/hooks';
import { meRoutes } from './routes/me';

type AppContext = { Bindings: Env; Variables: { container: Container; userId: string } };

export function createApp() {
  const app = new Hono<AppContext>();

  app.use('*', secureHeaders());
  app.use('*', async (c, next) => {
    c.set('container', buildContainer(c.env));
    await next();
  });

  // browser-facing routes: CORS locked to the dashboard origin, cookies allowed
  app.use('/me/*', (c, next) =>
    cors({ origin: c.env.APP_ORIGIN, credentials: true, allowMethods: ['GET', 'PATCH', 'POST'] })(c, next),
  );
  app.use('/features/*', (c, next) => cors({ origin: c.env.APP_ORIGIN, credentials: true })(c, next));

  // session guard for everything the dashboard calls
  const requireSession = createMiddleware<AppContext>(async (c, next) => {
    const userId = await readSession(c.req.header('Cookie'), c.env.SESSION_SECRET);
    if (!userId) return c.json({ error: 'unauthorized' }, 401);
    c.set('userId', userId);
    await next();
  });
  app.use('/me/*', requireSession);
  app.use('/me', requireSession);
  app.use('/features/*', requireSession);
  app.use('/features', requireSession);

  app.route('/auth', authRoutes);
  app.route('/', meRoutes);
  app.route('/hooks/plivo', plivoRoutes);
  app.route('/hooks/dodo', dodoRoutes);

  app.get('/health', (c) => c.json({ ok: true, service: 'wakeupbabe-api' }));

  app.onError((error, c) => {
    console.error('unhandled error:', error);
    return c.json({ error: 'internal error' }, 500);
  });

  return app;
}
