import * as Sentry from '@sentry/cloudflare';
import { TOPUP_PACK } from '@wakeupbabe/shared';
import { Hono } from 'hono';
import type { Container } from '../container';
import type { Env } from '../env';
import { hmacVerify } from '../lib/crypto';
import { logEvent } from '../lib/log';
import type { CallRow } from '../repos/calls';
import { VERIFICATION_SCRIPT } from '../services/calls/script';
import { buildGatherXml, buildSpeakXml } from '../services/telephony/xml';

type HookContext = { Bindings: Env; Variables: { container: Container } };

/**
 * Every telephony hook must pass two independent checks: the provider signature
 * (proves the carrier sent it) and our per-call HMAC token in the URL (proves we
 * created this callback for this call).
 */
async function authenticateCall(
  c: { req: { raw: Request; query: (k: string) => string | undefined }; get: (k: 'container') => Container },
  secret: string,
): Promise<CallRow | null> {
  const container = c.get('container');
  if (!(await container.telephony.verifyWebhook(c.req.raw))) return null;

  const callId = c.req.query('call');
  const token = c.req.query('tok');
  if (!callId || !token) return null;
  if (!(await hmacVerify(`call-callback:${callId}`, token, secret))) return null;

  return container.calls.findById(callId);
}

export const callRoutes = new Hono<HookContext>()
  .post('/answer', async (c) => {
    const call = await authenticateCall(c, c.env.SESSION_SECRET);
    if (!call) return c.text('forbidden', 403);
    const { lifecycle, events, scripts, dispatcher } = c.get('container');

    await lifecycle.onAnswered(call);

    const speech = call.isTest
      ? VERIFICATION_SCRIPT
      : await (async () => {
          const event = call.eventId ? await events.findById(call.eventId) : null;
          return event ? scripts.build(event) : VERIFICATION_SCRIPT;
        })();

    const xml = buildGatherXml({
      speech,
      repeatSpeech: 'Still there? Press 1 to confirm, or 2 to snooze.',
      actionUrl: await dispatcher.callbackUrl('input', call.id),
    });
    return c.text(xml, 200, { 'Content-Type': 'application/xml' });
  })

  .post('/input', async (c) => {
    const call = await authenticateCall(c, c.env.SESSION_SECRET);
    if (!call) return c.text('forbidden', 403);
    const { lifecycle } = c.get('container');

    const form = await c.req.raw.formData();
    const digit = String(form.get('Digits') ?? '');
    const result = await lifecycle.onDigit(call, digit);

    const goodbye =
      result === 'ack'
        ? 'Love that for you. Go crush it, babe.'
        : result === 'snooze'
          ? 'Fine, five more minutes. I will call back.'
          : 'That was not one of the options, but okay. Bye, babe.';
    return c.text(buildSpeakXml(goodbye), 200, { 'Content-Type': 'application/xml' });
  })

  .post('/hangup', async (c) => {
    const call = await authenticateCall(c, c.env.SESSION_SECRET);
    if (!call) return c.text('forbidden', 403);
    await c.get('container').lifecycle.onHangup(call);
    return c.text('ok');
  });

/**
 * Dodo Payments webhook, Standard Webhooks spec: signature is
 * base64(HMAC-SHA256(base64decode(secret), `${id}.${timestamp}.${body}`)).
 */
export async function verifyStandardWebhook(
  request: Request,
  body: string,
  secret: string,
): Promise<boolean> {
  const id = request.headers.get('webhook-id');
  const timestamp = request.headers.get('webhook-timestamp');
  const signatureHeader = request.headers.get('webhook-signature');
  if (!id || !timestamp || !signatureHeader) return false;

  // reject replays older than 5 minutes
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const rawSecret = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  const keyBytes = Uint8Array.from(atob(rawSecret), (ch) => ch.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${body}`));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));

  return signatureHeader.split(' ').some((part) => {
    const candidate = part.startsWith('v1,') ? part.slice(3) : part;
    if (candidate.length !== expected.length) return false;
    let mismatch = 0;
    for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ candidate.charCodeAt(i);
    return mismatch === 0;
  });
}

export interface DodoWebhookPayload {
  type: string;
  data: {
    customer?: { customer_id?: string };
    metadata?: { userId?: string };
    product_cart?: Array<{ product_id: string; quantity: number }>;
    subscription_id?: string;
    /** subscription events carry the full subscription snapshot; its status
     * is the source of truth for entitlement */
    status?: string;
    /** set while a cancellation is scheduled; the sub stays active until
     * the term ends */
    cancel_at_next_billing_date?: boolean;
  };
}

const SUBSCRIPTION_EVENTS = new Set([
  'subscription.active',
  'subscription.renewed',
  'subscription.updated',
  'subscription.plan_changed',
  'subscription.update_payment_method',
  'subscription.cancelled',
  'subscription.expired',
  'subscription.failed',
  'subscription.on_hold',
]);

/** statuses that end paid access; 'pending' and unknown values change nothing */
const REVOKED_STATUSES = new Set(['cancelled', 'expired', 'failed', 'on_hold', 'paused']);

/**
 * Applies one billing event to our state. The single source of truth for
 * plan flips and credit grants: the production webhook and the dev fake
 * checkout both go through here.
 */
export async function applyDodoEvent(
  container: Container,
  env: Env,
  payload: DodoWebhookPayload,
): Promise<void> {
  const { users } = container;

  // checkout metadata carries our user id; portal-initiated events may
  // not, so fall back to the customer id stored on first purchase
  const dodoCustomerId = payload.data.customer?.customer_id ?? null;
  const user =
    (payload.data.metadata?.userId ? await users.findById(payload.data.metadata.userId) : null) ??
    (dodoCustomerId ? await users.findByDodoCustomerId(dodoCustomerId) : null);
  if (!user) return;

  const subscriptionId = payload.data.subscription_id ?? null;
  // lifecycle events for a subscription that is no longer the user's
  // active one are stale (late retries after a resubscribe) and must not
  // touch the plan
  const staleSubscription =
    subscriptionId !== null && user.dodoSubscriptionId !== null && subscriptionId !== user.dodoSubscriptionId;

  if (SUBSCRIPTION_EVENTS.has(payload.type)) {
    if (staleSubscription) {
      if (payload.type === 'subscription.active' && user.plan === 'ride_or_die') {
        // two live subscriptions for one user: adopt the newest so its
        // lifecycle events govern, and say so loudly for ops
        logEvent('error', 'billing.double_subscription', {
          userId: user.id,
          newSubscriptionId: subscriptionId,
          activeSubscriptionId: user.dodoSubscriptionId,
        });
        Sentry.captureMessage(`possible double billing for user ${user.id}`, 'error');
        await users.setPlan(user.id, 'ride_or_die', dodoCustomerId, subscriptionId ?? undefined);
      }
      return;
    }

    /*
     * Entitlement follows the subscription's status snapshot, not the event
     * name. Observed in the wild: a portal cancellation fires
     * subscription.updated with status still 'active' and
     * cancel_at_next_billing_date true (paid term keeps running), and the
     * terminal event at the billing date may carry that same flag, so the
     * flag alone can never drive the downgrade.
     */
    const status = typeof payload.data.status === 'string' ? payload.data.status : null;
    if (status !== null) {
      if (status === 'active') {
        await users.setPlan(user.id, 'ride_or_die', dodoCustomerId, subscriptionId ?? undefined);
      } else if (REVOKED_STATUSES.has(status)) {
        await users.setPlan(user.id, 'situationship', dodoCustomerId, null);
      }
      return;
    }

    // status-less payloads (older shapes, local simulations): event names
    switch (payload.type) {
      case 'subscription.active':
      case 'subscription.renewed':
        await users.setPlan(user.id, 'ride_or_die', dodoCustomerId, subscriptionId ?? undefined);
        break;
      case 'subscription.cancelled':
        if (payload.data.cancel_at_next_billing_date) break;
        await users.setPlan(user.id, 'situationship', dodoCustomerId, null);
        break;
      case 'subscription.expired':
      case 'subscription.failed':
      case 'subscription.on_hold':
        await users.setPlan(user.id, 'situationship', dodoCustomerId, null);
        break;
      default:
        break;
    }
    return;
  }

  switch (payload.type) {
    case 'payment.succeeded': {
      // payment.succeeded also fires for subscription charges; only the
      // top-up product grants prepaid credits. A payment landing on an
      // already-downgraded account (cancel racing checkout) still credits:
      // the user paid, and the credits sit frozen until a resubscribe.
      const topupProductId = env.DODO_PRODUCT_TOPUP;
      const packs = (payload.data.product_cart ?? [])
        .filter((item) => Boolean(topupProductId) && item.product_id === topupProductId)
        .reduce((sum, item) => sum + item.quantity, 0);
      if (packs > 0) await users.addCallCredits(user.id, packs * TOPUP_PACK.calls, packs);
      break;
    }
    default:
      break;
  }
}

/** signed but structurally unusable payloads are acknowledged, not retried:
 * a retry cannot fix its shape */
function parsePayload(body: string): DodoWebhookPayload | null {
  try {
    const parsed = JSON.parse(body) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return null;
    const candidate = parsed as { type?: unknown; data?: unknown };
    if (typeof candidate.type !== 'string') return null;
    if (typeof candidate.data !== 'object' || candidate.data === null) return null;
    return candidate as DodoWebhookPayload;
  } catch {
    return null;
  }
}

export const dodoRoutes = new Hono<HookContext>().post('/', async (c) => {
  const body = await c.req.raw.text();
  if (!(await verifyStandardWebhook(c.req.raw, body, c.env.DODO_WEBHOOK_SECRET))) {
    return c.text('forbidden', 403);
  }

  const payload = parsePayload(body);
  if (!payload) return c.json({ ok: true, note: 'unrecognized payload shape, ignored' });

  const { webhookEvents } = c.get('container');

  // providers redeliver with the same id on retry; a second delivery must
  // not double-apply (credit grants are not naturally idempotent)
  const webhookId = c.req.header('webhook-id');
  if (webhookId && !(await webhookEvents.claim(webhookId, payload.type))) {
    return c.json({ ok: true, note: 'duplicate delivery, already processed' });
  }

  try {
    await applyDodoEvent(c.get('container'), c.env, payload);
  } catch (error) {
    // release the claim so the provider's retry is processed, not swallowed
    if (webhookId) await webhookEvents.release(webhookId).catch(() => undefined);
    throw error;
  }
  return c.json({ ok: true });
});
