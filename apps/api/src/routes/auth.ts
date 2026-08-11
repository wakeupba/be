import { Hono } from 'hono';
import type { Container } from '../container';
import type { Env } from '../env';
import { encryptSecret, hmacSign, hmacVerify } from '../lib/crypto';
import { logEvent } from '../lib/log';
import { claimRateSlot, clientIp } from '../lib/rate-limit';
import { clearSessionCookie, createSessionCookie } from '../lib/session';
import {
  CALENDAR_SCOPE,
  GoogleInvalidGrantError,
  type GoogleTokens,
} from '../services/calendar/google-client';

const STATE_TTL_MS = 10 * 60_000;
const LOGINS_PER_WINDOW = 30;
const CALLBACKS_PER_WINDOW = 10;
const RATE_WINDOW_MS = 10 * 60_000;

type AuthContext = { Bindings: Env; Variables: { container: Container } };

async function buildState(secret: string): Promise<string> {
  const body = btoa(JSON.stringify({ nonce: crypto.randomUUID(), expiresAt: Date.now() + STATE_TTL_MS }));
  return `${body}.${await hmacSign(body, secret)}`;
}

async function verifyState(state: string, secret: string): Promise<boolean> {
  const [body, signature] = state.split('.');
  if (!body || !signature) return false;
  if (!(await hmacVerify(body, signature, secret))) return false;
  try {
    const payload = JSON.parse(atob(body)) as { expiresAt: number };
    return payload.expiresAt > Date.now();
  } catch {
    return false;
  }
}

export const authRoutes = new Hono<AuthContext>()
  .get('/login', async (c) => {
    const { google } = c.get('container');
    if (
      !(await claimRateSlot(
        c.get('container'),
        `login:${clientIp(c.req.raw)}`,
        LOGINS_PER_WINDOW,
        RATE_WINDOW_MS,
      ))
    ) {
      return c.text('too many login attempts, try again in a few minutes', 429);
    }
    const redirectUri = `${c.env.API_ORIGIN}/auth/callback`;
    const state = await buildState(c.env.SESSION_SECRET);
    return c.redirect(google.buildAuthUrl(redirectUri, state));
  })

  .get('/callback', async (c) => {
    const { google, users, tokens } = c.get('container');
    const code = c.req.query('code');
    const state = c.req.query('state');
    if (!code || !state || !(await verifyState(state, c.env.SESSION_SECRET))) {
      return c.text('invalid oauth state', 400);
    }
    // metered only after the state check: a captured state token is valid
    // for its whole ttl and could otherwise hammer google's token endpoint,
    // while pure garbage fails fast above without burning slots for the
    // rest of a shared (cgnat) ip
    if (
      !(await claimRateSlot(
        c.get('container'),
        `callback:${clientIp(c.req.raw)}`,
        CALLBACKS_PER_WINDOW,
        RATE_WINDOW_MS,
      ))
    ) {
      logEvent('info', 'auth.callback_rate_limited', { ip: clientIp(c.req.raw) });
      return c.redirect(`${c.env.APP_ORIGIN}/login/?retry=busy`);
    }

    const redirectUri = `${c.env.API_ORIGIN}/auth/callback`;
    /*
     * Refreshing this URL, or landing on it with a code Google has already
     * consumed, is an expected thing a real person does. Send them back to
     * sign in rather than reporting an unhandled error: a raw 500 mid
     * signup is bad enough, and reporting it buries genuine failures in
     * Sentry under noise nobody can act on.
     */
    let granted: GoogleTokens;
    try {
      granted = await google.exchangeCode(code, redirectUri);
    } catch (error) {
      if (error instanceof GoogleInvalidGrantError) {
        logEvent('info', 'auth.code_already_used', { ip: clientIp(c.req.raw) });
        return c.redirect(`${c.env.APP_ORIGIN}/login/?retry=stale`);
      }
      throw error;
    }
    const info = await google.fetchUserInfo(granted.accessToken);

    let user = await users.findByGoogleSub(info.sub);
    const isNewUser = !user;
    if (!user) {
      user = await users.create({ googleSub: info.sub, email: info.email, displayName: info.name });
    }

    /*
     * Google's consent screen lets the user decline the calendar checkbox
     * while still completing sign-in. A grant without calendar scope must
     * not count as a connection: store nothing, land them in the app, and
     * the dashboard shows the honest disconnected state with a reconnect
     * path (never a forced consent loop against an explicit decline).
     */
    const grantsCalendar = granted.scope.includes(CALENDAR_SCOPE);
    if (granted.refreshToken && grantsCalendar) {
      await tokens.upsertRefreshToken(
        user.id,
        await encryptSecret(granted.refreshToken, c.env.TOKEN_ENC_KEY),
      );
      /* The exchange already handed us a usable access token, and the upsert
       * just cleared the one belonging to the grant this replaces. Keeping it
       * saves the next sync a refresh; more to the point, the alternative was
       * throwing it away and leaving the cache empty. */
      await tokens.cacheAccessToken(
        user.id,
        await encryptSecret(granted.accessToken, c.env.TOKEN_ENC_KEY),
        Date.now() + granted.expiresInSeconds * 1000,
      );
    } else if (grantsCalendar && !(await tokens.find(user.id))) {
      // calendar granted but no refresh token issued and none stored: only
      // a re-consent can produce one
      return c.redirect(`${c.env.API_ORIGIN}/auth/login`);
    }

    const { analytics } = c.get('container');
    if (isNewUser) await analytics.capture(user.id, 'signed up');
    if (granted.refreshToken && grantsCalendar) {
      await analytics.capture(user.id, 'calendar connected', { reconnect: !isNewUser });
    }

    c.header('Set-Cookie', await createSessionCookie(user.id, c.env.SESSION_SECRET, c.env.COOKIE_DOMAIN));
    return c.redirect(c.env.APP_ORIGIN);
  })

  .post('/logout', (c) => {
    c.header('Set-Cookie', clearSessionCookie(c.env.COOKIE_DOMAIN));
    return c.json({ ok: true });
  });
