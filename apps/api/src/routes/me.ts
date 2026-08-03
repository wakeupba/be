import {
  type CallHistoryDto,
  type FeatureCardDto,
  LEAD_MINUTE_OPTIONS,
  type LeadMinutes,
  type MeDto,
  PLAN_LIMITS,
  TOPUP_PACK,
  UPCOMING_FEATURES,
  type UpcomingEventDto,
} from '@wakeupbabe/shared';
import { Hono } from 'hono';
import { parsePhoneNumberFromString } from 'libphonenumber-js/min';
import type { Container } from '../container';
import type { Env } from '../env';
import { decryptSecret } from '../lib/crypto';
import { billingConfigured, fakeBillingActive } from '../services/billing/dodo';

const GOOGLE_COLOR_IDS = new Set(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11']);
const VERIFY_CALLS_PER_HOUR = 3;
const BILLING_ATTEMPTS_PER_WINDOW = 5;
const BILLING_WINDOW_MS = 10 * 60_000;

/** fake-checkout URLs are built from API_ORIGIN, which in dev may lag the
 * tunnel/port actually in use; the request URL's origin is what the browser
 * just proved it can reach */
function browserReachable(url: string, requestUrl: string, env: Env): string {
  if (!fakeBillingActive(env)) return url;
  const target = new URL(url);
  const origin = new URL(requestUrl);
  target.protocol = origin.protocol;
  target.host = origin.host;
  return target.toString();
}

/** claim one of N slots in the current time bucket; false = rate limited.
 * Rides on the webhook-events claim table, which the cron sweep prunes. */
async function claimBillingSlot(container: Container, key: string): Promise<boolean> {
  const bucket = Math.floor(Date.now() / BILLING_WINDOW_MS);
  for (let slot = 0; slot < BILLING_ATTEMPTS_PER_WINDOW; slot++) {
    if (await container.webhookEvents.claim(`rl:${key}:${bucket}:${slot}`, 'rate-limit')) return true;
  }
  return false;
}

type MeContext = { Bindings: Env; Variables: { container: Container; userId: string } };

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const meRoutes = new Hono<MeContext>()
  .get('/me', async (c) => {
    const { users, tokens } = c.get('container');
    const user = await users.findById(c.get('userId'));
    if (!user) return c.json({ error: 'not found' }, 404);
    const tokenRow = await tokens.find(user.id);
    const dto: MeDto = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      phone: user.phoneE164,
      brandNumber: c.env.TWILIO_FROM_NUMBER_US,
      plan: user.plan,
      callsUsed: user.callsUsedThisPeriod,
      callsLimit: PLAN_LIMITS[user.plan].callsPerMonth,
      extraCredits: user.extraCallCredits,
      triggerColorId: user.triggerColorId,
      leadMinutes: user.leadMinutes,
      timezone: user.timezone,
      dndVerified: user.dndVerifiedAt !== null,
      billingEnabled: billingConfigured(c.env),
      calendarConnected: tokenRow !== null,
    };
    return c.json(dto);
  })

  /*
   * Disconnect the calendar: revoke our grant at Google (best effort),
   * forget every credential, and cancel scheduled calls, because without
   * calendar access we cannot know if those meetings still exist.
   */
  .post('/me/calendar/disconnect', async (c) => {
    const { users, tokens, events, google } = c.get('container');
    const user = await users.findById(c.get('userId'));
    if (!user) return c.json({ error: 'not found' }, 404);

    const tokenRow = await tokens.find(user.id);
    if (!tokenRow) return c.json({ ok: true, note: 'already disconnected' });

    const refreshToken = await decryptSecret(tokenRow.refreshTokenEnc, c.env.TOKEN_ENC_KEY).catch(() => null);
    if (refreshToken) await google.revokeToken(refreshToken);
    await tokens.delete(user.id);
    const cancelled = await events.cancelAllActiveForUser(user.id);
    return c.json({ ok: true, cancelledCalls: cancelled });
  })

  /*
   * Hosted checkout: we never touch card data. Dodo is the merchant of
   * record; the webhook flips the plan / adds credits after payment.
   */
  .post('/me/billing/checkout', async (c) => {
    const { users, billing } = c.get('container');
    if (!(await claimBillingSlot(c.get('container'), `checkout:${c.get('userId')}`))) {
      return c.json({ error: 'too many checkout attempts, try again in a few minutes' }, 429);
    }
    if (!billing || !billingConfigured(c.env)) {
      return c.json({ error: 'billing is not open yet' }, 409);
    }
    const body = await c.req.json<{ kind?: string }>().catch(() => null);
    const kind = body?.kind;
    if (kind !== 'upgrade' && kind !== 'topup') {
      return c.json({ error: 'kind must be upgrade or topup' }, 400);
    }

    const user = await users.findById(c.get('userId'));
    if (!user) return c.json({ error: 'not found' }, 404);
    if (kind === 'upgrade' && user.plan === 'ride_or_die') {
      return c.json({ error: 'already on ride or die' }, 409);
    }
    // packs are extra calls on a plan, not an alternative to one: at
    // $2/20 vs $5/50 an ungated pack would undercut the subscription
    if (kind === 'topup' && user.plan !== 'ride_or_die') {
      return c.json({ error: 'top-ups need an active ride or die plan' }, 409);
    }
    // completed purchases this period; a card-testing guard, not economics
    if (kind === 'topup' && user.topupPacksThisPeriod >= TOPUP_PACK.maxPerPeriod) {
      return c.json({ error: 'pack limit reached for this billing period' }, 429);
    }

    const productId =
      kind === 'upgrade' ? (c.env.DODO_PRODUCT_RIDE_OR_DIE as string) : (c.env.DODO_PRODUCT_TOPUP as string);
    const { url } = await billing.createCheckout({
      productId,
      userId: user.id,
      email: user.email,
      name: user.displayName,
      customerId: user.dodoCustomerId,
      returnUrl: `${c.env.APP_ORIGIN}/billing/?checkout=success`,
    });
    return c.json({ url: browserReachable(url, c.req.url, c.env) });
  })

  .post('/me/billing/portal', async (c) => {
    const { users, billing } = c.get('container');
    if (!(await claimBillingSlot(c.get('container'), `portal:${c.get('userId')}`))) {
      return c.json({ error: 'too many attempts, try again in a few minutes' }, 429);
    }
    if (!billing || !billingConfigured(c.env)) {
      return c.json({ error: 'billing is not open yet' }, 409);
    }
    const user = await users.findById(c.get('userId'));
    if (!user) return c.json({ error: 'not found' }, 404);
    if (!user.dodoCustomerId) {
      return c.json({ error: 'no billing profile yet, make a purchase first' }, 409);
    }
    const { url } = await billing.createPortalSession(user.dodoCustomerId, `${c.env.APP_ORIGIN}/billing/`);
    return c.json({ url: browserReachable(url, c.req.url, c.env) });
  })

  .patch('/me/settings', async (c) => {
    const { users } = c.get('container');
    const body = await c.req.json<Record<string, unknown>>().catch(() => null);
    if (!body) return c.json({ error: 'invalid json' }, 400);

    const patch: Parameters<typeof users.updateSettings>[1] = {};

    if (body.phone !== undefined) {
      // real number validation, not just an E.164 shape: country prefix,
      // national length, and number-plan rules all checked
      const parsed = typeof body.phone === 'string' ? parsePhoneNumberFromString(body.phone) : undefined;
      if (!parsed?.isValid()) {
        return c.json({ error: 'not a real phone number, use international format like +14155550123' }, 400);
      }
      patch.phoneE164 = parsed.number;
      // a changed number loses its DND verification: we only ever call
      // numbers that have proven they ring through, so the test call re-runs
      const current = await users.findById(c.get('userId'));
      if (current && current.phoneE164 !== parsed.number) patch.dndVerifiedAt = null;
    }
    if (body.triggerColorId !== undefined) {
      if (typeof body.triggerColorId !== 'string' || !GOOGLE_COLOR_IDS.has(body.triggerColorId)) {
        return c.json({ error: 'triggerColorId must be a Google Calendar color id (1-11)' }, 400);
      }
      patch.triggerColorId = body.triggerColorId;
    }
    if (body.leadMinutes !== undefined) {
      if (!LEAD_MINUTE_OPTIONS.includes(body.leadMinutes as LeadMinutes)) {
        return c.json({ error: `leadMinutes must be one of ${LEAD_MINUTE_OPTIONS.join(', ')}` }, 400);
      }
      patch.leadMinutes = body.leadMinutes as LeadMinutes;
    }
    if (body.timezone !== undefined) {
      if (typeof body.timezone !== 'string' || !isValidTimezone(body.timezone)) {
        return c.json({ error: 'invalid IANA timezone' }, 400);
      }
      patch.timezone = body.timezone;
    }

    await users.updateSettings(c.get('userId'), patch);
    return c.json({ ok: true });
  })

  .get('/me/events', async (c) => {
    const { events } = c.get('container');
    const rows = await events.listUpcomingForUser(c.get('userId'), Date.now());
    const dtos: UpcomingEventDto[] = rows.map((row) => ({
      id: row.id,
      title: row.title,
      startsAt: row.startsAt,
      callAt: row.callAt,
      state: row.state,
      attendeeCount: row.attendeeCount,
    }));
    return c.json(dtos);
  })

  .get('/me/calls', async (c) => {
    const { calls, users } = c.get('container');
    const [rows, user] = await Promise.all([
      calls.listHistoryForUser(c.get('userId')),
      users.findById(c.get('userId')),
    ]);
    // Google Calendar's event deep link: base64("<eventId> <calendarEmail>"),
    // padding stripped. Our synced calendarId is always 'primary', so the
    // account email stands in for it.
    const calendarLink = (googleEventId: string | null): string | null => {
      if (!googleEventId || !user) return null;
      const eid = btoa(`${googleEventId} ${user.email}`).replace(/=+$/, '');
      return `https://calendar.google.com/calendar/event?eid=${eid}`;
    };
    const dtos: CallHistoryDto[] = rows.map((row) => ({
      id: row.id,
      eventId: row.eventId,
      eventTitle: row.eventTitle,
      eventStartsAt: row.eventStartsAt,
      attendeeCount: row.attendeeCount,
      colorId: row.colorId,
      calendarLink: calendarLink(row.googleEventId),
      attempt: row.attempt,
      createdAt: row.createdAt,
      placedAt: row.placedAt,
      answeredAt: row.answeredAt,
      endedAt: row.endedAt,
      outcome: row.outcome,
      isTest: row.isTest,
      providerCallId: row.providerCallId,
    }));
    return c.json(dtos);
  })

  .post('/me/verify-call', async (c) => {
    const { users, calls, dispatcher } = c.get('container');
    const user = await users.findById(c.get('userId'));
    if (!user) return c.json({ error: 'not found' }, 404);
    if (!user.phoneE164) return c.json({ error: 'add a phone number first' }, 400);

    const recent = await calls.countTestCallsSince(user.id, Date.now() - 60 * 60_000);
    if (recent >= VERIFY_CALLS_PER_HOUR) {
      return c.json({ error: 'too many verification calls, try again in an hour' }, 429);
    }

    const callId = await dispatcher.placeVerificationCall(user);
    return c.json({ ok: true, callId });
  })

  .get('/features', async (c) => {
    const { votes } = c.get('container');
    const counts = await votes.countsWithMine(c.get('userId'));
    const dtos: FeatureCardDto[] = UPCOMING_FEATURES.map((feature) => ({
      ...feature,
      votes: counts.get(feature.key)?.votes ?? 0,
      votedByMe: counts.get(feature.key)?.mine ?? false,
    }));
    return c.json(dtos);
  })

  .post('/features/:key/vote', async (c) => {
    const key = c.req.param('key');
    if (!UPCOMING_FEATURES.some((f) => f.key === key)) return c.json({ error: 'unknown feature' }, 404);
    const body = await c.req.json<{ note?: string }>().catch(() => ({ note: undefined }));
    const note = typeof body.note === 'string' ? body.note.slice(0, 500) : null;
    const { votes } = c.get('container');
    await votes.toggle(key, c.get('userId'), note);
    return c.json({ ok: true });
  });
