import { env } from 'cloudflare:test';
import { hmacSign, SESSION_COOKIE } from '@wakeupbabe/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import type { Env } from '../src/env';
import { DodoBillingProvider } from '../src/services/billing/dodo';
import { seedUser, testDb } from './helpers';

/*
 * The launch-day incident this pins: Dodo answered checkout-session creation
 * with `403 Live payments not enabled for merchant`, the exception reached
 * the app-wide handler, and the buy button rendered as a 500 crash. The
 * provider refusing us is an answer, not our failure — the route owes the
 * client an honest 503 it can display, never a generic crash.
 */

const billingEnv: Env = {
  ...env,
  DODO_API_KEY: 'dodo_test_deadbeef',
  DODO_ENVIRONMENT: 'test_mode',
  DODO_PRODUCT_RIDE_OR_DIE: 'pdt_ride',
  DODO_PRODUCT_TOPUP: 'pdt_topup',
};

const refusal = () => Promise.reject(new Error('403 Live payments not enabled for merchant'));

async function authedPost(path: string, userId: string): Promise<Response> {
  const body = btoa(JSON.stringify({ userId, expiresAt: Date.now() + 60_000 }));
  const cookie = `${SESSION_COOKIE}=${body}.${await hmacSign(body, env.SESSION_SECRET)}`;
  return createApp().request(
    new Request(`https://api.test${path}`, {
      method: 'POST',
      headers: { cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'upgrade' }),
    }),
    undefined,
    billingEnv,
  );
}

afterEach(() => vi.restoreAllMocks());

describe('billing when the provider refuses', () => {
  it('checkout answers an honest 503, not a 500 crash', async () => {
    vi.spyOn(DodoBillingProvider.prototype, 'createCheckout').mockImplementation(refusal);
    const user = await seedUser(testDb());

    const response = await authedPost('/me/billing/checkout', user.id);

    expect(response.status).toBe(503);
    const body = (await response.json()) as { error: string; code?: string };
    expect(body.code).toBe('billing_unavailable');
    expect(body.error).not.toContain('internal');
  });

  it('the portal answers the same contract', async () => {
    vi.spyOn(DodoBillingProvider.prototype, 'createPortalSession').mockImplementation(refusal);
    const user = await seedUser(testDb(), { dodoCustomerId: 'cus_123' });

    const response = await authedPost('/me/billing/portal', user.id);

    expect(response.status).toBe(503);
    const body = (await response.json()) as { code?: string };
    expect(body.code).toBe('billing_unavailable');
  });
});
