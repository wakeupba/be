import { env } from 'cloudflare:test';
import { TOPUP_PACK } from '@wakeupbabe/shared';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { CreditGrantRepo } from '../src/repos/credit-grants';
import { UserRepo } from '../src/repos/users';
import { seedUser, testDb } from './helpers';

const WEBHOOK_SECRET = `whsec_${btoa('dodo-signing-key-for-tests')}`;
const TOPUP_PRODUCT = 'prod_topup_pack';

async function signedRequest(payload: unknown, id = `msg_${crypto.randomUUID()}`): Promise<Request> {
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000);
  const keyBytes = Uint8Array.from(atob(WEBHOOK_SECRET.slice(6)), (ch) => ch.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${body}`));
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
  return { ...env, DODO_WEBHOOK_SECRET: WEBHOOK_SECRET, DODO_PRODUCT_TOPUP: TOPUP_PRODUCT };
}

async function deliver(payload: unknown, id?: string) {
  return createApp().request(await signedRequest(payload, id), undefined, testEnv());
}

function topup(userId: string, paymentId: string, packs = 1) {
  return {
    type: 'payment.succeeded',
    data: {
      metadata: { userId },
      payment_id: paymentId,
      product_cart: [{ product_id: TOPUP_PRODUCT, quantity: packs }],
    },
  };
}

describe('refunds and disputes take the entitlement back', () => {
  it('a refunded top-up loses exactly the credits it granted', async () => {
    const db = testDb();
    const users = new UserRepo(db);
    const user = await seedUser(db, { plan: 'ride_or_die' });
    const paymentId = `pay_${crypto.randomUUID()}`;

    await deliver(topup(user.id, paymentId, 2));
    expect((await users.findById(user.id))?.extraCallCredits).toBe(TOPUP_PACK.calls * 2);

    await deliver({
      type: 'refund.succeeded',
      data: { metadata: { userId: user.id }, payment_id: paymentId, is_partial: false },
    });

    const after = await users.findById(user.id);
    expect(after?.extraCallCredits).toBe(0);
    // the per-period pack cap has to come back too, or a refund loop would
    // burn someone's purchase allowance
    expect(after?.topupPacksThisPeriod).toBe(0);
    expect(after?.plan).toBe('ride_or_die'); // the subscription is untouched
  });

  it('reverses only the refunded payment, not every top-up the user bought', async () => {
    const db = testDb();
    const users = new UserRepo(db);
    const user = await seedUser(db, { plan: 'ride_or_die' });
    const kept = `pay_${crypto.randomUUID()}`;
    const refunded = `pay_${crypto.randomUUID()}`;

    await deliver(topup(user.id, kept, 1));
    await deliver(topup(user.id, refunded, 1));
    expect((await users.findById(user.id))?.extraCallCredits).toBe(TOPUP_PACK.calls * 2);

    await deliver({
      type: 'refund.succeeded',
      data: { metadata: { userId: user.id }, payment_id: refunded, is_partial: false },
    });

    const after = await users.findById(user.id);
    expect(after?.extraCallCredits).toBe(TOPUP_PACK.calls);
    expect(after?.topupPacksThisPeriod).toBe(1);
  });

  it('a dispute lost through Visa RDR revokes the same way a refund does', async () => {
    const db = testDb();
    const users = new UserRepo(db);
    const user = await seedUser(db, { plan: 'ride_or_die' });
    const paymentId = `pay_${crypto.randomUUID()}`;
    await deliver(topup(user.id, paymentId));

    await deliver({
      type: 'dispute.lost',
      data: {
        metadata: { userId: user.id },
        payment_id: paymentId,
        dispute_status: 'dispute_lost',
        is_resolved_by_rdr: true,
      },
    });

    expect((await users.findById(user.id))?.extraCallCredits).toBe(0);
  });

  it('leaves the credits alone when the dispute is won or merely opened', async () => {
    const db = testDb();
    const users = new UserRepo(db);
    const user = await seedUser(db, { plan: 'ride_or_die' });
    const paymentId = `pay_${crypto.randomUUID()}`;
    await deliver(topup(user.id, paymentId));

    for (const type of ['dispute.opened', 'dispute.challenged', 'dispute.won', 'dispute.cancelled']) {
      await deliver({ data: { metadata: { userId: user.id }, payment_id: paymentId }, type });
    }

    expect((await users.findById(user.id))?.extraCallCredits).toBe(TOPUP_PACK.calls);
  });

  it('takes the credits off once when a payment is both disputed and refunded', async () => {
    const db = testDb();
    const users = new UserRepo(db);
    const grants = new CreditGrantRepo(db);
    const user = await seedUser(db, { plan: 'ride_or_die' });
    const paymentId = `pay_${crypto.randomUUID()}`;

    await deliver(topup(user.id, paymentId, 1));
    // buy a second pack so a double reversal would be visible rather than
    // hidden by the floor at zero
    await deliver(topup(user.id, `pay_${crypto.randomUUID()}`, 1));

    await deliver({
      type: 'dispute.lost',
      data: { metadata: { userId: user.id }, payment_id: paymentId },
    });
    await deliver({
      type: 'refund.succeeded',
      data: { metadata: { userId: user.id }, payment_id: paymentId, is_partial: false },
    });

    const after = await users.findById(user.id);
    expect(after?.extraCallCredits).toBe(TOPUP_PACK.calls); // one pack, not zero
    expect((await grants.find(paymentId))?.revokedReason).toBe('dispute.lost');
  });

  it('floors at zero when the credits were already spent', async () => {
    const db = testDb();
    const users = new UserRepo(db);
    const user = await seedUser(db, { plan: 'ride_or_die', callsUsedThisPeriod: 999 });
    const paymentId = `pay_${crypto.randomUUID()}`;
    await deliver(topup(user.id, paymentId, 1));

    // spend the pack: allowance is exhausted, so every call comes off credits
    const before = await users.findById(user.id);
    if (!before) throw new Error('user vanished');
    for (let n = 0; n < TOPUP_PACK.calls; n++) {
      const current = await users.findById(user.id);
      if (current) await users.consumeCall(current, 0);
    }
    expect((await users.findById(user.id))?.extraCallCredits).toBe(0);

    await deliver({
      type: 'refund.succeeded',
      data: { metadata: { userId: user.id }, payment_id: paymentId, is_partial: false },
    });

    // no negative balance: a debt we would never collect is worse than nothing
    expect((await users.findById(user.id))?.extraCallCredits).toBe(0);
  });

  it('leaves a partial refund for a human instead of guessing', async () => {
    const db = testDb();
    const users = new UserRepo(db);
    const grants = new CreditGrantRepo(db);
    const user = await seedUser(db, { plan: 'ride_or_die' });
    const paymentId = `pay_${crypto.randomUUID()}`;
    await deliver(topup(user.id, paymentId, 1));

    await deliver({
      type: 'refund.succeeded',
      data: { metadata: { userId: user.id }, payment_id: paymentId, is_partial: true },
    });

    // untouched, and still claimable once someone decides what it should be
    expect((await users.findById(user.id))?.extraCallCredits).toBe(TOPUP_PACK.calls);
    expect((await grants.find(paymentId))?.revokedAt ?? null).toBeNull();
  });

  it('a reversed subscription charge ends paid access', async () => {
    const db = testDb();
    const users = new UserRepo(db);
    const user = await seedUser(db, { plan: 'ride_or_die', dodoCustomerId: 'cus_x' });
    const paymentId = `pay_${crypto.randomUUID()}`;

    // the subscription charge: payment.succeeded with nothing from the top-up
    // product in the cart, which records a grant of kind 'subscription'
    await deliver({
      type: 'payment.succeeded',
      data: { metadata: { userId: user.id }, payment_id: paymentId, product_cart: [] },
    });
    expect((await new CreditGrantRepo(db).find(paymentId))?.kind).toBe('subscription');
    expect((await users.findById(user.id))?.extraCallCredits).toBe(0); // granted nothing

    await deliver({ type: 'dispute.lost', data: { metadata: { userId: user.id }, payment_id: paymentId } });

    const after = await users.findById(user.id);
    expect(after?.plan).toBe('situationship');
    // the customer id survives, so a resubscribe still finds its profile
    expect(after?.dodoCustomerId).toBe('cus_x');
  });

  it('never downgrades on an unrecorded payment, since that could be a failed write', async () => {
    const db = testDb();
    const users = new UserRepo(db);
    const user = await seedUser(db, { plan: 'ride_or_die' });

    // no ledger row at all. This used to be read as "must have been the
    // subscription", which punished the user twice whenever it was wrong
    await deliver({
      type: 'refund.succeeded',
      data: { metadata: { userId: user.id }, payment_id: `pay_${crypto.randomUUID()}`, is_partial: false },
    });

    expect((await users.findById(user.id))?.plan).toBe('ride_or_die');
  });

  it('leaves an expired dispute for a human rather than guessing', async () => {
    const db = testDb();
    const users = new UserRepo(db);
    const user = await seedUser(db, { plan: 'ride_or_die' });
    const paymentId = `pay_${crypto.randomUUID()}`;
    await deliver(topup(user.id, paymentId));

    /* Dodo says an expired dispute "typically resolves against you", and
     * typically is not always, so neither reversing nor ignoring is safe to
     * automate. Nothing changes and the delivery is acknowledged. */
    const response = await deliver({
      type: 'dispute.expired',
      data: { metadata: { userId: user.id }, payment_id: paymentId, dispute_status: 'dispute_expired' },
    });

    expect(response.status).toBe(200);
    const after = await users.findById(user.id);
    expect(after?.extraCallCredits).toBe(TOPUP_PACK.calls);
    expect(after?.plan).toBe('ride_or_die');
    // still claimable, so whoever reads the dispute can act on it
    expect((await new CreditGrantRepo(db).find(paymentId))?.revokedAt ?? null).toBeNull();
  });

  it('acknowledges a reversal it cannot act on rather than failing the delivery', async () => {
    const db = testDb();
    const user = await seedUser(db, { plan: 'situationship' });

    const response = await deliver({
      type: 'refund.succeeded',
      data: { metadata: { userId: user.id } }, // no payment_id at all
    });

    // a 5xx would have Dodo retrying forever over something a retry cannot fix
    expect(response.status).toBe(200);
  });
});
