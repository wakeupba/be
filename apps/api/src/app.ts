import * as Sentry from '@sentry/cloudflare';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createMiddleware } from 'hono/factory';
import { secureHeaders } from 'hono/secure-headers';
import { buildContainer, type Container } from './container';
import type { Env } from './env';
import { errorFields, logEvent } from './lib/log';
import { readSession } from './lib/session';
import { authRoutes } from './routes/auth';
import { demoRoutes } from './routes/demo';
import { devRoutes } from './routes/dev';
import { callRoutes, demoCallRoutes, dodoRoutes } from './routes/hooks';
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

  // logout is the one auth route the dashboard calls with fetch; login and
  // the oauth callback are top-level navigations and never need CORS
  app.use('/auth/logout', (c, next) =>
    cors({ origin: c.env.APP_ORIGIN, credentials: true, allowMethods: ['POST'] })(c, next),
  );

  // the demo call, also from the landing page and also sessionless. CORS is not
  // a security boundary here (a script can send whatever Origin it likes); the
  // Turnstile token is. This just keeps other sites' pages from using it
  app.use('/demo/*', (c, next) =>
    cors({ origin: c.env.LANDING_ORIGIN, allowMethods: ['GET', 'POST'] })(c, next),
  );

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
  app.route('/', demoRoutes);
  app.route('/hooks/call', callRoutes);
  app.route('/hooks/demo', demoCallRoutes);
  app.route('/hooks/dodo', dodoRoutes);
  // local stand-ins for Dodo's hosted pages; hard-gated to fake mode
  app.route('/dev', devRoutes);

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
    // inline: iOS Safari opens the native contact sheet instead of putting a
    // mystery file in Downloads; Android still downloads (no inline handler)
    return c.text(vcard, 200, {
      'Content-Type': 'text/vcard; charset=utf-8',
      'Content-Disposition': 'inline; filename="wake-up-babe.vcf"',
    });
  });

  app.onError((error, c) => {
    // Hono resolves errors into a 500 response, so Sentry's fetch
    // instrumentation never sees them; hand them over explicitly
    logEvent('error', 'http.unhandled_error', {
      method: c.req.method,
      path: c.req.path,
      ...errorFields(error),
    });
    Sentry.captureException(error);
    return c.json({ error: 'internal error' }, 500);
  });

  return app;
}
