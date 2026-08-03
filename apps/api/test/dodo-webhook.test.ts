import { env } from 'cloudflare:test';
import { TOPUP_PACK } from '@wakeupbabe/shared';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { UserRepo } from '../src/repos/users';
import { seedUser, testDb } from './helpers';

const WEBHOOK_SECRET = `whsec_${btoa('dodo-signing-key-for-tests')}`;
const TOPUP_PRODUCT = 'prod_topup_pack';
const SUB_PRODUCT = 'prod_ride_or_die';

async function signedRequest(payload: unknown, id?: string): Promise<Request> {
  return signedRawRequest(JSON.stringify(payload), id);
}

async function signedRawRequest(body: string, id = `msg_${crypto.randomUUID()}`): Promise<Request> {
  const timestamp = Math.floor(Date.now() / 1000);
  const keyBytes = Uint8Array.from(atob(WEBHOOK_SECRET.slice(6)), (ch) => ch.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const mac = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${id}.${timestamp}.${body}`),
  );
  const signature = btoa(String.fromCharCode(...new Uint8Array(mac)));

  return new Request('https://api.test/hooks/dodo', {
    method: 'POST',
    body,
    headers: {
      'content-type': 'application/json',
      'webhook-id': id,
      'webhook-timestamp': String(timestamp),
      'webhook-signature': `v1,${signature}`,
    },
  });
}

function testEnv() {
  return {
    ...env,
    DODO_WEBHOOK_SECRET: WEBHOOK_SECRET,
    DODO_PRODUCT_TOPUP: TOPUP_PRODUCT,
    DODO_PRODUCT_RIDE_OR_DIE: SUB_PRODUCT,
  };
}

describe('dodo webhook, end to end against the app', () => {
  it('rejects unsigned requests', async () => {
    const app = createApp();
    const response = await app.request(
      new Request('https://api.test/hooks/dodo', { method: 'POST', body: '{}' }),
      undefined,
      testEnv(),
    );
    expect(response.status).toBe(403);
  });

  it('subscription.active flips the plan and stores the customer id', async () => {
    const db = testDb();
    const users = new UserRepo(db);
    const user = await seedUser(db);
    const app = createApp();

    const response = await app.request(
      await signedRequest({
        type: 'subscription.active',
        data: { customer: { customer_id: 'cus_1' }, metadata: { userId: user.id } },
      }),
      undefined,
      testEnv(),
    );

    expect(response.status).toBe(200);
    const updated = await users.findById(user.id);
    expect(updated?.plan).toBe('ride_or_die');
    expect(updated?.dodoCustomerId).toBe('cus_1');
  });

  it('subscription.cancelled downgrades to the free plan', async () => {
    const db = testDb();
    const users = new UserRepo(db);
    const user = await seedUser(db, { plan: 'ride_or_die' });
    const app = createApp();

    await app.request(
      await signedRequest({
        type: 'subscription.cancelled',
        data: { customer: { customer_id: 'cus_1' }, metadata: { userId: user.id } },
      }),
      undefined,
      testEnv(),
    );

    expect((await users.findById(user.id))?.plan).toBe('situationship');
  });

  it('a top-up payment grants TOPUP_PACK.calls credits per pack and counts the packs', async () => {
    const db = testDb();
    const users = new UserRepo(db);
    const user = await seedUser(db);
    const app = createApp();

    await app.request(
      await signedRequest({
        type: 'payment.succeeded',
        data: {
          metadata: { userId: user.id },
          product_cart: [{ product_id: TOPUP_PRODUCT, quantity: 2 }],
        },
      }),
      undefined,
      testEnv(),
    );

    const updated = await users.findById(user.id);
    expect(updated?.extraCallCredits).toBe(TOPUP_PACK.calls * 2);
    expect(updated?.topupPacksThisPeriod).toBe(2);
  });

  it('a subscription charge never grants top-up credits', async () => {
    const db = testDb();
    const users = new UserRepo(db);
    const user = await seedUser(db);
    const app = createApp();

    await app.request(
      await signedRequest({
        type: 'payment.succeeded',
        data: {
          metadata: { userId: user.id },
          product_cart: [{ product_id: SUB_PRODUCT, quantity: 1 }],
        },
      }),
      undefined,
      testEnv(),
    );

    expect((await users.findById(user.id))?.extraCallCredits).toBe(0);
  });

  it('events without user metadata are acknowledged and ignored', async () => {
    const app = createApp();
    const response = await app.request(
      await signedRequest({ type: 'subscription.active', data: {} }),
      undefined,
      testEnv(),
    );
    expect(response.status).toBe(200);
  });

  it('a redelivered webhook never double-applies: credits granted once', async () => {
    const db = testDb();
    const users = new UserRepo(db);
    const user = await seedUser(db);
    const app = createApp();
    const payload = {
      type: 'payment.succeeded',
      data: { metadata: { userId: user.id }, product_cart: [{ product_id: TOPUP_PRODUCT, quantity: 1 }] },
    };

    await app.request(await signedRequest(payload, 'msg_retry_same_id'), undefined, testEnv());
    await app.request(await signedRequest(payload, 'msg_retry_same_id'), undefined, testEnv());

    expect((await users.findById(user.id))?.extraCallCredits).toBe(TOPUP_PACK.calls);
  });

  it('cancelling mid-cycle keeps the paid plan until the term ends', async () => {
    const db = testDb();
    const users = new UserRepo(db);
    const user = await seedUser(db, { plan: 'ride_or_die' });
    const app = createApp();

    // the user clicks cancel: access is scheduled to end, not revoked
    await app.request(
      await signedRequest({
        type: 'subscription.cancelled',
        data: { metadata: { userId: user.id }, cancel_at_next_billing_date: true },
      }),
      undefined,
      testEnv(),
    );
    expect((await users.findById(user.id))?.plan).toBe('ride_or_die');

    // the paid term actually ends: now access is revoked
    await app.request(
      await signedRequest({ type: 'subscription.expired', data: { metadata: { userId: user.id } } }),
      undefined,
      testEnv(),
    );
    expect((await users.findById(user.id))?.plan).toBe('situationship');
  });

  it('cancel then resubscribe in the same cycle: plan never drops, quota never resets', async () => {
    const db = testDb();
    const users = new UserRepo(db);
    const user = await seedUser(db, { plan: 'ride_or_die', callsUsedThisPeriod: 12 });
    const app = createApp();

    await app.request(
      await signedRequest({
        type: 'subscription.cancelled',
        data: { metadata: { userId: user.id }, cancel_at_next_billing_date: true },
      }),
      undefined,
      testEnv(),
    );
    await app.request(
      await signedRequest({ type: 'subscription.active', data: { metadata: { userId: user.id } } }),
      undefined,
      testEnv(),
    );

    const updated = await users.findById(user.id);
    expect(updated?.plan).toBe('ride_or_die');
    // no cancel-and-resubscribe quota refresh exploit
    expect(updated?.callsUsedThisPeriod).toBe(12);
  });

  it('a failed renewal (on_hold) revokes the paid plan', async () => {
    const db = testDb();
    const users = new UserRepo(db);
    const user = await seedUser(db, { plan: 'ride_or_die' });
    const app = createApp();

    await app.request(
      await signedRequest({ type: 'subscription.on_hold', data: { metadata: { userId: user.id } } }),
      undefined,
      testEnv(),
    );
    expect((await users.findById(user.id))?.plan).toBe('situationship');
  });

  it('portal events without metadata resolve through the stored customer id', async () => {
    const db = testDb();
    const users = new UserRepo(db);
    const user = await seedUser(db, { plan: 'ride_or_die', dodoCustomerId: 'cus_known' });
    const app = createApp();

    await app.request(
      await signedRequest({
        type: 'subscription.cancelled',
        data: { customer: { customer_id: 'cus_known' }, cancel_at_next_billing_date: false },
      }),
      undefined,
      testEnv(),
    );
    expect((await users.findById(user.id))?.plan).toBe('situationship');
  });

  it('signed but malformed payloads are acknowledged, never retried forever', async () => {
    const app = createApp();
    const rawBodies = [
      'not json at all',
      '42',
      '"a bare string"',
      'null',
      '{"type":7,"data":{}}',
      '{"type":"subscription.active"}',
      '{"type":"subscription.active","data":null}',
    ];
    for (const body of rawBodies) {
      const response = await app.request(await signedRawRequest(body), undefined, testEnv());
      expect(response.status, `body: ${body}`).toBe(200);
    }
  });

  it('a stale lifecycle event from a replaced subscription never downgrades', async () => {
    const db = testDb();
    const users = new UserRepo(db);
    const user = await seedUser(db, { plan: 'ride_or_die', dodoSubscriptionId: 'sub_new' });
    const app = createApp();

    // late retry of the OLD subscription's cancellation, after a resubscribe
    await app.request(
      await signedRequest({
        type: 'subscription.expired',
        data: { metadata: { userId: user.id }, subscription_id: 'sub_old' },
      }),
      undefined,
      testEnv(),
    );
    expect((await users.findById(user.id))?.plan).toBe('ride_or_die');

    // the ACTIVE subscription expiring still downgrades
    await app.request(
      await signedRequest({
        type: 'subscription.expired',
        data: { metadata: { userId: user.id }, subscription_id: 'sub_new' },
      }),
      undefined,
      testEnv(),
    );
    const after = await users.findById(user.id);
    expect(after?.plan).toBe('situationship');
    expect(after?.dodoSubscriptionId).toBeNull();
  });

  it('activation stores the subscription id that lifecycle events are checked against', async () => {
    const db = testDb();
    const users = new UserRepo(db);
    const user = await seedUser(db);
    const app = createApp();

    await app.request(
      await signedRequest({
        type: 'subscription.active',
        data: { metadata: { userId: user.id }, subscription_id: 'sub_a' },
      }),
      undefined,
      testEnv(),
    );
    expect((await users.findById(user.id))?.dodoSubscriptionId).toBe('sub_a');

    // a second, different activation adopts the newest subscription
    await app.request(
      await signedRequest({
        type: 'subscription.active',
        data: { metadata: { userId: user.id }, subscription_id: 'sub_b' },
      }),
      undefined,
      testEnv(),
    );
    const after = await users.findById(user.id);
    expect(after?.dodoSubscriptionId).toBe('sub_b');
    expect(after?.plan).toBe('ride_or_die');
  });

  it('portal cancel (updated, status active, flag set) keeps the paid plan — observed shape', async () => {
    const db = testDb();
    const users = new UserRepo(db);
    const user = await seedUser(db, { plan: 'ride_or_die', dodoSubscriptionId: 'sub_real' });
    const app = createApp();

    await app.request(
      await signedRequest({
        type: 'subscription.updated',
        data: {
          metadata: { userId: user.id },
          subscription_id: 'sub_real',
          status: 'active',
          cancel_at_next_billing_date: true,
        },
      }),
      undefined,
      testEnv(),
    );
    expect((await users.findById(user.id))?.plan).toBe('ride_or_die');
  });

  it('the terminal cancelled event downgrades even with the schedule flag still set', async () => {
    const db = testDb();
    const users = new UserRepo(db);
    const user = await seedUser(db, { plan: 'ride_or_die', dodoSubscriptionId: 'sub_real' });
    const app = createApp();

    // at the billing date the subscription snapshot flips to cancelled but
    // may still carry cancel_at_next_billing_date: true; status must win
    await app.request(
      await signedRequest({
        type: 'subscription.cancelled',
        data: {
          metadata: { userId: user.id },
          subscription_id: 'sub_real',
          status: 'cancelled',
          cancel_at_next_billing_date: true,
        },
      }),
      undefined,
      testEnv(),
    );
    const after = await users.findById(user.id);
    expect(after?.plan).toBe('situationship');
    expect(after?.dodoSubscriptionId).toBeNull();
  });

  it('an updated event whose snapshot says on_hold revokes the plan', async () => {
    const db = testDb();
    const users = new UserRepo(db);
    const user = await seedUser(db, { plan: 'ride_or_die', dodoSubscriptionId: 'sub_real' });
    const app = createApp();

    await app.request(
      await signedRequest({
        type: 'subscription.updated',
        data: { metadata: { userId: user.id }, subscription_id: 'sub_real', status: 'on_hold' },
      }),
      undefined,
      testEnv(),
    );
    expect((await users.findById(user.id))?.plan).toBe('situationship');
  });

  it('a failed claim can be released and re-claimed (retry after crash)', async () => {
    const db = testDb();
    const { WebhookEventRepo } = await import('../src/repos/webhook-events');
    const repo = new WebhookEventRepo(db);

    expect(await repo.claim('msg_crash', 'payment.succeeded')).toBe(true);
    expect(await repo.claim('msg_crash', 'payment.succeeded')).toBe(false);
    await repo.release('msg_crash');
    expect(await repo.claim('msg_crash', 'payment.succeeded')).toBe(true);
  });
});

describe('dev fake checkout', () => {
  const fakeEnv = () => ({
    ...env,
    DODO_API_KEY: '',
    DODO_FAKE_CHECKOUT: '1',
    DODO_PRODUCT_RIDE_OR_DIE: 'prod_local_ride_or_die',
    DODO_PRODUCT_TOPUP: 'prod_local_topup',
  });

  it('is a 404 unless fake mode is explicitly on without a real key', async () => {
    const app = createApp();
    for (const override of [
      { DODO_FAKE_CHECKOUT: '' },
      { DODO_FAKE_CHECKOUT: '1', DODO_API_KEY: 'real_key' },
    ]) {
      const response = await app.request(
        new Request('https://api.test/dev/fake-checkout'),
        undefined,
        { ...fakeEnv(), ...override },
      );
      expect(response.status).toBe(404);
    }
  });

  it('paying the fake checkout upgrades through the same event pipeline', async () => {
    const db = testDb();
    const users = new UserRepo(db);
    const user = await seedUser(db);
    const app = createApp();

    const form = new FormData();
    form.set('product', 'prod_local_ride_or_die');
    form.set('user', user.id);
    form.set('return', 'https://app.test/billing/?checkout=success');
    form.set('action', 'pay');
    const response = await app.request(
      new Request('https://api.test/dev/fake-checkout', { method: 'POST', body: form }),
      undefined,
      fakeEnv(),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toContain('status=succeeded');
    const updated = await users.findById(user.id);
    expect(updated?.plan).toBe('ride_or_die');
    expect(updated?.dodoSubscriptionId).toBe('sub_fake_local');
  });

  it('failing the fake checkout changes nothing and reports failed', async () => {
    const db = testDb();
    const users = new UserRepo(db);
    const user = await seedUser(db);
    const app = createApp();

    const form = new FormData();
    form.set('product', 'prod_local_ride_or_die');
    form.set('user', user.id);
    form.set('return', 'https://app.test/billing/?checkout=success');
    form.set('action', 'fail');
    const response = await app.request(
      new Request('https://api.test/dev/fake-checkout', { method: 'POST', body: form }),
      undefined,
      fakeEnv(),
    );

    expect(response.headers.get('location')).toContain('status=failed');
    expect((await users.findById(user.id))?.plan).toBe('situationship');
  });

  it('fake topup grants credits through the product guard', async () => {
    const db = testDb();
    const users = new UserRepo(db);
    const user = await seedUser(db);
    const app = createApp();

    const form = new FormData();
    form.set('product', 'prod_local_topup');
    form.set('user', user.id);
    form.set('return', 'https://app.test/billing/?checkout=success');
    form.set('action', 'pay');
    await app.request(
      new Request('https://api.test/dev/fake-checkout', { method: 'POST', body: form }),
      undefined,
      fakeEnv(),
    );

    expect((await users.findById(user.id))?.extraCallCredits).toBe(TOPUP_PACK.calls);
  });

  it('fake portal cancel-at-period-end keeps the plan; expire revokes it', async () => {
    const db = testDb();
    const users = new UserRepo(db);
    // storage is shared across tests in this pool; a unique customer id
    // keeps the fallback lookup from resolving another test's user
    const customerId = `cus_${crypto.randomUUID()}`;
    const user = await seedUser(db, {
      plan: 'ride_or_die',
      dodoCustomerId: customerId,
      dodoSubscriptionId: 'sub_fake_local',
    });
    const app = createApp();

    const post = (action: string) => {
      const form = new FormData();
      form.set('customer', customerId);
      form.set('return', 'https://app.test/billing/');
      form.set('action', action);
      return app.request(
        new Request('https://api.test/dev/fake-portal', { method: 'POST', body: form }),
        undefined,
        fakeEnv(),
      );
    };

    await post('cancel');
    expect((await users.findById(user.id))?.plan).toBe('ride_or_die');
    await post('expire');
    expect((await users.findById(user.id))?.plan).toBe('situationship');
  });
});

describe('billing endpoint rate limiting', () => {
  it('caps checkout attempts per window', async () => {
    const db = testDb();
    const user = await seedUser(db);
    const { hmacSign, SESSION_COOKIE } = await import('@wakeupbabe/shared');
    const sessionBody = btoa(JSON.stringify({ userId: user.id, expiresAt: Date.now() + 60_000 }));
    const cookie = `${SESSION_COOKIE}=${sessionBody}.${await hmacSign(sessionBody, env.SESSION_SECRET)}`;
    const app = createApp();

    const attempt = () =>
      app.request(
        new Request('https://api.test/me/billing/checkout', {
          method: 'POST',
          body: JSON.stringify({ kind: 'upgrade' }),
          headers: { 'content-type': 'application/json', cookie },
        }),
        undefined,
        // billing deliberately unconfigured (fake mode off too): attempts
        // bounce with 409 but still consume rate slots, so the 6th is 429
        {
          ...env,
          DODO_API_KEY: '',
          DODO_PRODUCT_RIDE_OR_DIE: '',
          DODO_PRODUCT_TOPUP: '',
          DODO_FAKE_CHECKOUT: '',
        },
      );

    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await attempt()).status);
    expect(statuses.slice(0, 5)).toEqual([409, 409, 409, 409, 409]);
    expect(statuses[5]).toBe(429);
  });
});

describe('top-up rules', () => {
  const fakeEnv = () => ({
    ...env,
    DODO_API_KEY: '',
    DODO_FAKE_CHECKOUT: '1',
    DODO_PRODUCT_RIDE_OR_DIE: 'prod_local_ride_or_die',
    DODO_PRODUCT_TOPUP: 'prod_local_topup',
  });

  async function sessionCookie(userId: string): Promise<string> {
    const { hmacSign, SESSION_COOKIE } = await import('@wakeupbabe/shared');
    const body = btoa(JSON.stringify({ userId, expiresAt: Date.now() + 60_000 }));
    return `${SESSION_COOKIE}=${body}.${await hmacSign(body, env.SESSION_SECRET)}`;
  }

  const checkout = async (userId: string, kind: string) =>
    createApp().request(
      new Request('https://api.test/me/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({ kind }),
        headers: { 'content-type': 'application/json', cookie: await sessionCookie(userId) },
      }),
      undefined,
      fakeEnv(),
    );

  it('free users cannot buy packs: they would undercut the subscription', async () => {
    const user = await seedUser(testDb());
    const response = await checkout(user.id, 'topup');
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'top-ups need an active ride or die plan' });
  });

  it('subscribers under the cap get a checkout url', async () => {
    const user = await seedUser(testDb(), { plan: 'ride_or_die' });
    const response = await checkout(user.id, 'topup');
    expect(response.status).toBe(200);
    expect(((await response.json()) as { url: string }).url).toContain('/dev/fake-checkout');
  });

  it('the per-period pack cap stops the 11th purchase', async () => {
    const user = await seedUser(testDb(), {
      plan: 'ride_or_die',
      topupPacksThisPeriod: TOPUP_PACK.maxPerPeriod,
    });
    const response = await checkout(user.id, 'topup');
    expect(response.status).toBe(429);
  });

  it('credits freeze on downgrade and thaw on resubscribe', async () => {
    const db = testDb();
    const users = new UserRepo(db);
    // subscribed once, stockpiled packs, then cancelled: allowance spent,
    // credits in the bank, plan back on free
    const user = await seedUser(db, {
      plan: 'situationship',
      callsUsedThisPeriod: 5,
      extraCallCredits: 40,
    });

    expect(await users.consumeCall(user, 5)).toBe(false);
    expect((await users.findById(user.id))?.extraCallCredits).toBe(40);

    await users.setPlan(user.id, 'ride_or_die', 'cus_thaw', 'sub_thaw');
    const resubscribed = await users.findById(user.id);
    if (!resubscribed) throw new Error('user vanished');
    expect(await users.consumeCall(resubscribed, 5)).toBe(true);
    expect((await users.findById(user.id))?.extraCallCredits).toBe(39);
  });

  it('a paid-plan downgrade mid-flight cannot spend credits: the plan guard is in the UPDATE', async () => {
    const db = testDb();
    const users = new UserRepo(db);
    // the row snapshot says ride_or_die but the DB row is already free:
    // exactly the race between a webhook downgrade and a cron dispatch
    const user = await seedUser(db, {
      plan: 'situationship',
      callsUsedThisPeriod: 5,
      extraCallCredits: 3,
    });
    const staleSnapshot = { ...user, plan: 'ride_or_die' as const };

    expect(await users.consumeCall(staleSnapshot, 5)).toBe(false);
    expect((await users.findById(user.id))?.extraCallCredits).toBe(3);
  });

  it('the period reset clears the pack counter with the allowance', async () => {
    const db = testDb();
    const users = new UserRepo(db);
    const user = await seedUser(db, {
      plan: 'ride_or_die',
      callsUsedThisPeriod: 12,
      topupPacksThisPeriod: 7,
      periodStartedAt: Date.now() - 31 * 24 * 60 * 60_000,
    });

    await users.resetPeriodIfElapsed(user, 30 * 24 * 60 * 60_000);
    const reset = await users.findById(user.id);
    expect(reset?.callsUsedThisPeriod).toBe(0);
    expect(reset?.topupPacksThisPeriod).toBe(0);
  });

  it('a topup payment landing on an already-downgraded account still credits, frozen', async () => {
    const db = testDb();
    const users = new UserRepo(db);
    const user = await seedUser(db, { callsUsedThisPeriod: 5 }); // free, allowance spent
    const app = createApp();

    await app.request(
      await signedRequest({
        type: 'payment.succeeded',
        data: {
          metadata: { userId: user.id },
          product_cart: [{ product_id: TOPUP_PRODUCT, quantity: 1 }],
        },
      }),
      undefined,
      testEnv(),
    );

    const updated = await users.findById(user.id);
    expect(updated?.extraCallCredits).toBe(TOPUP_PACK.calls);
    // and the freeze keeps them unspendable until a resubscribe
    if (!updated) throw new Error('user vanished');
    expect(await users.consumeCall(updated, 5)).toBe(false);
  });
});
