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
import { isCallableNumber, priceCall } from '../lib/call-rates';
import { decryptSecret } from '../lib/crypto';
import { errorFields, logEvent } from '../lib/log';
import { claimRateSlot } from '../lib/rate-limit';
import type { TrackedEventRow } from '../repos/events';
import { billingConfigured, fakeBillingActive } from '../services/billing/dodo';
import { ON_DEMAND_COOLDOWN_MS } from '../services/calendar/sync';

const GOOGLE_COLOR_IDS = new Set(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11']);
const VERIFY_CALLS_PER_HOUR = 3;
const BILLING_ATTEMPTS_PER_WINDOW = 5;
const WRITE_ATTEMPTS_PER_WINDOW = 30;
// the dashboard refreshes on mount and on tab focus, so this sits well above
// what tabbing around can produce while still walling off a script
const SYNCS_PER_WINDOW = 60;
const RATE_WINDOW_MS = 10 * 60_000;
const HOUR_MS = 60 * 60_000;

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

type MeContext = { Bindings: Env; Variables: { container: Container; userId: string } };

function upcomingDtos(rows: TrackedEventRow[]): UpcomingEventDto[] {
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    startsAt: row.startsAt,
    callAt: row.callAt,
    state: row.state,
    attendeeCount: row.attendeeCount,
  }));
}

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
    // each disconnect fires a revocation call at google; keep it human-paced
    if (
      !(await claimRateSlot(
        c.get('container'),
        `disconnect:${c.get('userId')}`,
        BILLING_ATTEMPTS_PER_WINDOW,
        RATE_WINDOW_MS,
      ))
    ) {
      return c.json({ error: 'too many attempts, try again in a few minutes' }, 429);
    }
    const user = await users.findById(c.get('userId'));
    if (!user) return c.json({ error: 'not found' }, 404);

    const tokenRow = await tokens.find(user.id);
    if (!tokenRow) return c.json({ ok: true, note: 'already disconnected' });

    const refreshToken = await decryptSecret(tokenRow.refreshTokenEnc, c.env.TOKEN_ENC_KEY).catch(() => null);
    if (refreshToken) await google.revokeToken(refreshToken);
    await tokens.delete(user.id);
    const cancelled = await events.cancelAllActiveForUser(user.id);
    await c.get('container').analytics.capture(user.id, 'calendar disconnected', {
      cancelledCalls: cancelled,
    });
    return c.json({ ok: true, cancelledCalls: cancelled });
  })

  /*
   * Hosted checkout: we never touch card data. Dodo is the merchant of
   * record; the webhook flips the plan / adds credits after payment.
   */
  .post('/me/billing/checkout', async (c) => {
    const { users, billing } = c.get('container');
    const checkoutKey = `checkout:${c.get('userId')}`;
    if (
      !(await claimRateSlot(c.get('container'), checkoutKey, BILLING_ATTEMPTS_PER_WINDOW, RATE_WINDOW_MS))
    ) {
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
    let url: string;
    try {
      ({ url } = await billing.createCheckout({
        productId,
        userId: user.id,
        email: user.email,
        name: user.displayName,
        customerId: user.dodoCustomerId,
        returnUrl: `${c.env.APP_ORIGIN}/billing/?checkout=success`,
      }));
    } catch (error) {
      /* Dodo refusing us (live payments not yet enabled, an outage, a bad
       * key) is their answer, not our crash. The buy button degrades to
       * honesty instead of a 500 that reads as the product being broken. */
      logEvent('error', 'billing.checkout_failed', { kind, ...errorFields(error) });
      return c.json(
        { error: 'checkout is having a moment, try again shortly', code: 'billing_unavailable' },
        503,
      );
    }
    await c.get('container').analytics.capture(user.id, 'checkout opened', { kind });
    return c.json({ url: browserReachable(url, c.req.url, c.env) });
  })

  .post('/me/billing/portal', async (c) => {
    const { users, billing } = c.get('container');
    const portalKey = `portal:${c.get('userId')}`;
    if (!(await claimRateSlot(c.get('container'), portalKey, BILLING_ATTEMPTS_PER_WINDOW, RATE_WINDOW_MS))) {
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
    let url: string;
    try {
      ({ url } = await billing.createPortalSession(user.dodoCustomerId, `${c.env.APP_ORIGIN}/billing/`));
    } catch (error) {
      // same contract as checkout: the provider's refusal is not our crash
      logEvent('error', 'billing.portal_failed', errorFields(error));
      return c.json(
        { error: 'the billing portal is having a moment, try again shortly', code: 'billing_unavailable' },
        503,
      );
    }
    return c.json({ url: browserReachable(url, c.req.url, c.env) });
  })

  .patch('/me/settings', async (c) => {
    const { users, tokens, events } = c.get('container');
    // generous for humans, a wall for scripts hammering DB writes
    if (
      !(await claimRateSlot(
        c.get('container'),
        `settings:${c.get('userId')}`,
        WRITE_ATTEMPTS_PER_WINDOW,
        RATE_WINDOW_MS,
      ))
    ) {
      return c.json({ error: 'too many changes, try again in a few minutes' }, 429);
    }
    const body = await c.req.json<Record<string, unknown>>().catch(() => null);
    if (!body) return c.json({ error: 'invalid json' }, 400);

    const current = await users.findById(c.get('userId'));
    if (!current) return c.json({ error: 'not found' }, 404);

    const patch: Parameters<typeof users.updateSettings>[1] = {};

    // set only when a phone survives validation; read after the row persists,
    // because an analytics event about a save that then failed would be a lie
    let savedPhoneCountry: string | null = null;
    if (body.phone !== undefined) {
      // real number validation, not just an E.164 shape: country prefix,
      // national length, and number-plan rules all checked
      const parsed = typeof body.phone === 'string' ? parsePhoneNumberFromString(body.phone) : undefined;
      if (!parsed?.isValid()) {
        return c.json({ error: 'not a real phone number, use international format like +14155550123' }, 400);
      }
      /* a valid number we cannot afford to ring is a different answer from an
       * invalid one, and gets its own code so the client can say "not here
       * yet" instead of "wrong number". The number is kept as demand signal
       * and deliberately not saved to the account: nothing downstream should
       * believe this user has a reachable phone. */
      if (!isCallableNumber(parsed.number)) {
        const { regionInterest } = c.get('container');
        // the destination, never the number: this is what decides which region
        // to open next, and the subscriber digits add nothing to that
        const priced = priceCall(parsed.number);
        await regionInterest.record(c.get('userId'), {
          country: parsed.country ?? null,
          prefix: priced?.prefix ?? null,
          rateUsd: priced?.usd ?? null,
        });
        logEvent('info', 'phone.region_unsupported', {
          userId: c.get('userId'),
          country: parsed.country ?? 'unknown',
          rateUsd: priced?.usd ?? null,
        });
        await c.get('container').analytics.capture(c.get('userId'), 'phone region unsupported', {
          country: parsed.country ?? 'unknown',
          rateUsd: priced?.usd ?? null,
        });
        return c.json(
          { error: 'we cannot ring numbers in your country yet', code: 'region_unsupported' },
          422,
        );
      }
      patch.phoneE164 = parsed.number;
      // a changed number loses its DND verification: we only ever call
      // numbers that have proven they ring through, so the test call re-runs
      if (current.phoneE164 !== parsed.number) {
        patch.dndVerifiedAt = null;
        savedPhoneCountry = parsed.country ?? 'unknown';
      }
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
    if (savedPhoneCountry !== null) {
      await c.get('container').analytics.capture(c.get('userId'), 'phone saved', {
        country: savedPhoneCountry,
      });
    }

    /*
     * Both of these change what we already decided about meetings we already
     * track, and neither is something Google will tell us about: the delta
     * sync only returns events *it* considers changed, so without this a
     * setting would only take effect on meetings edited afterwards.
     */
    if (patch.leadMinutes !== undefined && patch.leadMinutes !== current.leadMinutes) {
      await events.recomputeCallTimes(current.id, patch.leadMinutes);
    }
    if (patch.triggerColorId !== undefined && patch.triggerColorId !== current.triggerColorId) {
      // a new trigger color re-decides every meeting, including ones we
      // ignored and therefore never stored: only a full window settles it
      await tokens.forceFullResync(current.id);
    }
    return c.json({ ok: true });
  })

  .get('/me/events', async (c) => {
    const { events } = c.get('container');
    const rows = await events.listUpcomingForUser(c.get('userId'), Date.now());
    return c.json(upcomingDtos(rows));
  })

  /*
   * On-demand calendar refresh. The cron is the guarantee that a flagged
   * meeting gets called; this endpoint is for the impatience in between —
   * flag something, open the dashboard, see it. Returns the event list with
   * it so the page needs one round trip, and reports the cooldown so the UI
   * can say "checked just now" instead of appearing to ignore the click.
   */
  .post('/me/sync', async (c) => {
    const { users, tokens, events, sync } = c.get('container');
    // the cooldown already caps Google traffic; this caps the D1 reads a
    // script could drive by hammering a cooling-down endpoint
    if (
      !(await claimRateSlot(c.get('container'), `sync:${c.get('userId')}`, SYNCS_PER_WINDOW, RATE_WINDOW_MS))
    ) {
      return c.json({ error: 'too many refreshes, try again in a few minutes' }, 429);
    }
    const user = await users.findById(c.get('userId'));
    if (!user) return c.json({ error: 'not found' }, 404);
    if (!(await tokens.find(user.id))) return c.json({ error: 'calendar is not connected' }, 409);

    const result = await sync.syncOnDemand(user);
    const rows = await events.listUpcomingForUser(user.id, Date.now());
    return c.json({
      status: result.status,
      checkedAt: result.lastAttemptAt,
      nextRefreshAt: result.lastAttemptAt + ON_DEMAND_COOLDOWN_MS,
      events: upcomingDtos(rows),
    });
  })

  /** one call's outcome, for the verification step's status poll: fetching
   * the whole history every tick would be waste */
  .get('/me/calls/:id', async (c) => {
    const { calls } = c.get('container');
    const call = await calls.findById(c.req.param('id'));
    if (!call || call.userId !== c.get('userId')) return c.json({ error: 'not found' }, 404);
    return c.json({ outcome: call.outcome });
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
    const { users, calls, dispatcher, analytics } = c.get('container');
    const user = await users.findById(c.get('userId'));
    if (!user) return c.json({ error: 'not found' }, 404);
    if (!user.phoneE164) return c.json({ error: 'add a phone number first' }, 400);
    /* checked again at ring time, not just at save time: numbers saved before
     * this gate existed are still on file, and Twilio's prices move */
    if (!isCallableNumber(user.phoneE164)) {
      return c.json({ error: 'we cannot ring numbers in your country yet', code: 'region_unsupported' }, 422);
    }

    const recent = await calls.countTestCallsSince(user.id, Date.now() - HOUR_MS);
    if (recent >= VERIFY_CALLS_PER_HOUR) {
      return c.json({ error: 'too many verification calls, try again in an hour' }, 429);
    }
    // and per NUMBER across accounts: without this, farmed accounts sharing
    // one victim number turn the test call into a phone-DoS
    if (
      !(await claimRateSlot(
        c.get('container'),
        `verify:num:${user.phoneE164}`,
        VERIFY_CALLS_PER_HOUR,
        HOUR_MS,
      ))
    ) {
      return c.json({ error: 'this number has had too many verification calls, try again in an hour' }, 429);
    }

    const callId = await dispatcher.placeVerificationCall(user);
    await analytics.capture(user.id, 'verification call requested');
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
    if (
      !(await claimRateSlot(
        c.get('container'),
        `vote:${c.get('userId')}`,
        WRITE_ATTEMPTS_PER_WINDOW,
        RATE_WINDOW_MS,
      ))
    ) {
      return c.json({ error: 'too many votes, try again in a few minutes' }, 429);
    }
    const key = c.req.param('key');
    if (!UPCOMING_FEATURES.some((f) => f.key === key)) return c.json({ error: 'unknown feature' }, 404);
    const body = await c.req.json<{ note?: string }>().catch(() => ({ note: undefined }));
    const note = typeof body.note === 'string' ? body.note.slice(0, 500) : null;
    const { votes } = c.get('container');
    await votes.toggle(key, c.get('userId'), note);
    await c.get('container').analytics.capture(c.get('userId'), 'feature vote toggled', {
      feature: key,
      hasNote: note !== null,
    });
    return c.json({ ok: true });
  });
