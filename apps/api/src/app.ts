import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createMiddleware } from 'hono/factory';
import { secureHeaders } from 'hono/secure-headers';
import { buildContainer, type Container } from './container';
import type { Env } from './env';
import { readSession } from './lib/session';
import { authRoutes } from './routes/auth';
import { callRoutes, dodoRoutes } from './routes/hooks';
import { meRoutes } from './routes/me';
import { waitlistRoutes } from './routes/waitlist';

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

  // waitlist is called from the public landing page, no session involved
  app.use('/waitlist', (c, next) => cors({ origin: c.env.LANDING_ORIGIN })(c, next));

  // minimal auth probe for the landing header; credentials allowed so the
  // shared-domain session cookie rides along
  app.use('/session', (c, next) => cors({ origin: c.env.LANDING_ORIGIN, credentials: true })(c, next));
  app.get('/session', async (c) => {
    const userId = await readSession(c.req.header('Cookie'), c.env.SESSION_SECRET);
    return c.json({ authenticated: userId !== null });
  });

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
  app.route('/waitlist', waitlistRoutes);
  app.route('/hooks/call', callRoutes);
  app.route('/hooks/dodo', dodoRoutes);

  app.get('/health', (c) => c.json({ ok: true, service: 'wakeupbabe-api' }));

  // public contact card; the number is the product's public identity
  app.get('/contact.vcf', (c) => {
    const vcard = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'FN:Wake Up Babe',
      'ORG:Wake Up Babe',
      `TEL;TYPE=CELL,VOICE:${c.env.TWILIO_FROM_NUMBER_US}`,
      'URL:https://wakeupba.be',
      'NOTE:Calls you before the meetings you color red. Allow this contact through Do Not Disturb: Emergency Bypass on iPhone, starred contact on Android.',
      'END:VCARD',
      '',
    ].join('\r\n');
    return c.text(vcard, 200, {
      'Content-Type': 'text/vcard; charset=utf-8',
      'Content-Disposition': 'attachment; filename="wake-up-babe.vcf"',
    });
  });

  app.onError((error, c) => {
    console.error('unhandled error:', error);
    return c.json({ error: 'internal error' }, 500);
  });

  return app;
}
