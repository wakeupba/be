import { Hono } from 'hono';
import type { Container } from '../container';
import type { Env } from '../env';
import { encryptSecret, hmacSign, hmacVerify } from '../lib/crypto';
import { clearSessionCookie, createSessionCookie } from '../lib/session';

const STATE_TTL_MS = 10 * 60_000;

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

    const redirectUri = `${c.env.API_ORIGIN}/auth/callback`;
    const granted = await google.exchangeCode(code, redirectUri);
    const info = await google.fetchUserInfo(granted.accessToken);

    let user = await users.findByGoogleSub(info.sub);
    if (!user) {
      user = await users.create({ googleSub: info.sub, email: info.email, displayName: info.name });
    }

    if (granted.refreshToken) {
      await tokens.upsertRefreshToken(
        user.id,
        await encryptSecret(granted.refreshToken, c.env.TOKEN_ENC_KEY),
      );
    } else if (!(await tokens.find(user.id))) {
      // no refresh token and none stored: force a re-consent
      return c.redirect(`${c.env.API_ORIGIN}/auth/login`);
    }

    c.header('Set-Cookie', await createSessionCookie(user.id, c.env.SESSION_SECRET, c.env.COOKIE_DOMAIN));
    return c.redirect(c.env.APP_ORIGIN);
  })

  .post('/logout', (c) => {
    c.header('Set-Cookie', clearSessionCookie(c.env.COOKIE_DOMAIN));
    return c.json({ ok: true });
  });
