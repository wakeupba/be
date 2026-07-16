import { Hono } from 'hono';
import type { Container } from '../container';
import type { Env } from '../env';
import { hmacVerify } from '../lib/crypto';
import type { CallRow } from '../repos/calls';
import { VERIFICATION_SCRIPT } from '../services/calls/script';
import { buildGatherXml, buildSpeakXml } from '../services/telephony/xml';

type HookContext = { Bindings: Env; Variables: { container: Container } };

/**
 * Every Plivo hook must pass two independent checks: the provider signature
 * (proves Plivo sent it) and our per-call HMAC token in the URL (proves we
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
  if (!(await hmacVerify(`plivo-callback:${callId}`, token, secret))) return null;

  return container.calls.findById(callId);
}

export const plivoRoutes = new Hono<HookContext>()
  .post('/answer', async (c) => {
    const call = await authenticateCall(c, c.env.SESSION_SECRET);
    if (!call) return c.text('forbidden', 403);
    const { lifecycle, events, scripts, dispatcher } = c.get('container');

    await lifecycle.onAnswered(call);

    const speech =
      call.is_test === 1
        ? VERIFICATION_SCRIPT
        : await (async () => {
            const event = call.event_id ? await events.findById(call.event_id) : null;
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
async function verifyStandardWebhook(request: Request, body: string, secret: string): Promise<boolean> {
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

interface DodoWebhookPayload {
  type: string;
  data: {
    customer?: { customer_id?: string };
    metadata?: { user_id?: string };
    product_cart?: Array<{ product_id: string; quantity: number }>;
  };
}

const CREDITS_PER_PACK = 50;

export const dodoRoutes = new Hono<HookContext>().post('/', async (c) => {
  const body = await c.req.raw.text();
  if (!(await verifyStandardWebhook(c.req.raw, body, c.env.DODO_WEBHOOK_SECRET))) {
    return c.text('forbidden', 403);
  }

  const payload = JSON.parse(body) as DodoWebhookPayload;
  const userId = payload.data.metadata?.user_id;
  if (!userId) return c.json({ ok: true, note: 'no user metadata, ignored' });

  const { users } = c.get('container');
  const dodoCustomerId = payload.data.customer?.customer_id ?? null;

  // TODO: confirm exact event type strings against the Dodo dashboard before launch
  switch (payload.type) {
    case 'subscription.active':
    case 'subscription.renewed':
      await users.setPlan(userId, 'ride_or_die', dodoCustomerId);
      break;
    case 'subscription.cancelled':
    case 'subscription.expired':
    case 'subscription.failed':
      await users.setPlan(userId, 'situationship', dodoCustomerId);
      break;
    case 'payment.succeeded': {
      const packs = (payload.data.product_cart ?? []).reduce((sum, item) => sum + item.quantity, 0);
      if (packs > 0) await users.addCallCredits(userId, packs * CREDITS_PER_PACK);
      break;
    }
    default:
      break;
  }
  return c.json({ ok: true });
});
