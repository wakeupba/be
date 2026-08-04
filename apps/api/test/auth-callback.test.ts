import { env } from 'cloudflare:test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { hmacSign } from '../src/lib/crypto';

/*
 * Google's token endpoint is stubbed, so these assert our behaviour rather
 * than the network's. Any other outbound call throws, which keeps the test
 * honest about what the callback actually reaches for.
 */
afterEach(() => {
  vi.unstubAllGlobals();
});

/** replies as many times as asked, so a loop of attempts can share one stub */
function stubTokenEndpoint(status: number, body: string): void {
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith('https://oauth2.googleapis.com/token')) return new Response(body, { status });
    throw new Error(`unexpected outbound fetch to ${url}`);
  });
}

async function signedState(): Promise<string> {
  const body = btoa(JSON.stringify({ nonce: crypto.randomUUID(), expiresAt: Date.now() + 60_000 }));
  return `${body}.${await hmacSign(body, env.SESSION_SECRET)}`;
}

const callback = async (code: string) =>
  createApp().request(
    new Request(
      `https://api.test/auth/callback?code=${code}&state=${encodeURIComponent(await signedState())}`,
      // a fresh ip per call so the per-ip limiter never colours a result
      { headers: { 'CF-Connecting-IP': `test-ip-${crypto.randomUUID()}` } },
    ),
    undefined,
    env,
  );

describe('oauth callback', () => {
  it('sends an already-used code back to sign in, not to an error page', async () => {
    // exactly what refreshing the callback url produces
    stubTokenEndpoint(400, JSON.stringify({ error: 'invalid_grant' }));

    const response = await callback('already-spent');

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(`${env.APP_ORIGIN}/login/?retry=stale`);
  });

  it('sends a rate-limited attempt back to sign in too, not to a bare 429', async () => {
    // one ip, past the window: every one of these carries a valid state, so
    // each spends a slot before reaching google
    const ip = `test-ip-${crypto.randomUUID()}`;
    stubTokenEndpoint(400, JSON.stringify({ error: 'invalid_grant' }));
    const attempt = async () =>
      createApp().request(
        new Request(
          `https://api.test/auth/callback?code=x&state=${encodeURIComponent(await signedState())}`,
          { headers: { 'CF-Connecting-IP': ip } },
        ),
        undefined,
        env,
      );

    for (let n = 0; n < 10; n++) await attempt();
    const limited = await attempt();

    expect(limited.status).toBe(302);
    expect(limited.headers.get('location')).toBe(`${env.APP_ORIGIN}/login/?retry=busy`);
  });

  it('still surfaces an unexpected google failure instead of swallowing it', async () => {
    stubTokenEndpoint(503, 'upstream is down');

    const response = await callback('fine-code');

    expect(response.status).toBe(500);
  });
});
