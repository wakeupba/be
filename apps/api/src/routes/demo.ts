import { Hono } from 'hono';
import { parsePhoneNumberFromString } from 'libphonenumber-js/min';
import type { Container } from '../container';
import type { Env } from '../env';
import { callRateUsd, isCallableNumber, isSupportedCountry } from '../lib/call-rates';
import { hmacSign } from '../lib/crypto';
import { logEvent } from '../lib/log';
import { clientIp } from '../lib/rate-limit';

/*
 * "Type your number, your phone rings." The strongest proof this product can
 * offer, and the only endpoint that spends real money for someone with no
 * account, no session, and no payment method.
 *
 * So the shape of it is: every limit is checked before anything is dialled, the
 * cost is reserved before the call is placed, and every failure mode refuses
 * rather than allows. There is no configuration of this endpoint that lets an
 * unbounded number of calls out.
 */

const TURNSTILE_ACTION = 'demo-call';

/** Twilio bills a whole minute, so this is USD per demo call. The default is
 * small on purpose: it is a launch-stage guard, not a marketing budget. */
const DEFAULT_WEEKLY_BUDGET_USD = 10;
const WEEK_MS = 7 * 24 * 60 * 60_000;
const DAY_MS = 24 * 60 * 60_000;

/* Budget is counted in thousandths of a dollar so it can live in an integer
 * counter. Costs round up, so the budget is never overspent by rounding. */
const MILLS_PER_USD = 1000;

/** per visitor, and per number, on the same allowance: a number is as likely
 * to be a person trying the product as an address is */
const PER_DAY = 2;
const PER_WEEK = 3;

const RING_TIMEOUT_SECONDS = 25;

type DemoContext = { Bindings: Env; Variables: { container: Container } };

function weeklyBudgetUsd(env: Env): number {
  const configured = Number(env.DEMO_WEEKLY_BUDGET_USD);
  return Number.isFinite(configured) && configured >= 0 ? configured : DEFAULT_WEEKLY_BUDGET_USD;
}

/** the demo is off unless a challenge is configured. Fail closed: an
 * unprotected endpoint that dials phone numbers is worse than no demo */
function demoConfigured(env: Env): boolean {
  return Boolean(env.TURNSTILE_SECRET) && weeklyBudgetUsd(env) > 0;
}

/* identifiers are kept as HMACs, so the table can enforce "same number again"
 * without holding the numbers of people who never signed up */
function fingerprint(value: string, secret: string): Promise<string> {
  return hmacSign(`demo:${value}`, secret);
}

function budgetMills(env: Env): number {
  return Math.round(weeklyBudgetUsd(env) * MILLS_PER_USD);
}

/** rounds up, so a fractional cost can never be spent for free */
export function costMills(costUsd: number): number {
  return Math.max(1, Math.ceil(costUsd * MILLS_PER_USD));
}

/** the week a demo call was charged to, derived from when it happened rather
 * than from now, so a refund lands in the same window as the spend even if the
 * call outlived the boundary */
export function budgetKeyFor(atMs: number): string {
  return `demo:mills:${Math.floor(atMs / WEEK_MS)}`;
}

export const demoRoutes = new Hono<DemoContext>()
  /*
   * Whether to show the CTA at all. Deliberately says nothing about why: a
   * visitor sees a demo or does not, and an attacker learns nothing about which
   * limit they are up against.
   */
  .get('/demo/availability', async (c) => {
    if (!demoConfigured(c.env)) return c.json({ available: false });

    /* Hidden rather than offered-then-refused for visitors in countries we
     * cannot ring. They can still sign up: the plan is that the limit turns up
     * at onboarding, where their country gets recorded, not on the landing page
     * where it would read as "this product is not for you".
     *
     * Cloudflare sets this header; absent means dev or an unknown network, and
     * the CTA shows. Nothing about spending money depends on it, since the
     * number itself is checked when the call is asked for. */
    const country = c.req.header('CF-IPCountry');
    if (country && country !== 'XX' && !isSupportedCountry(country)) {
      return c.json({ available: false });
    }

    const spent = await c.get('container').counters.read(budgetKeyFor(Date.now()));
    return c.json({ available: spent < budgetMills(c.env) });
  })

  .post('/demo/call', async (c) => {
    const container = c.get('container');
    if (!demoConfigured(c.env)) return c.json({ error: 'demo is not available' }, 503);

    const ip = clientIp(c.req.raw);
    const body = await c.req.json<{ phone?: unknown; token?: unknown }>().catch(() => null);
    const token = typeof body?.token === 'string' ? body.token : '';
    if (!token) return c.json({ error: 'challenge missing' }, 400);

    /* the challenge is checked first, before any database work: it is the layer
     * that makes the rest of these limits meaningful, since without it an
     * attacker just rotates addresses */
    const secret = c.env.TURNSTILE_SECRET as string;
    if (!(await verifyChallenge(token, secret, ip))) {
      logEvent('info', 'demo.challenge_failed', { ip });
      return c.json({ error: 'challenge failed' }, 403);
    }

    const parsed = typeof body?.phone === 'string' ? parsePhoneNumberFromString(body.phone) : undefined;
    if (!parsed?.isValid()) {
      return c.json({ error: 'that does not look like a phone number' }, 400);
    }
    const phone = parsed.number;

    // same cost cap as signup, on purpose: demoing to someone we would then
    // turn away at onboarding is a worse experience than not demoing
    if (!isCallableNumber(phone)) {
      return c.json({ error: 'we cannot ring numbers in your country yet', code: 'region_unsupported' }, 422);
    }
    const costUsd = callRateUsd(phone) ?? 0;

    const [phoneHash, ipHash] = await Promise.all([
      fingerprint(phone, c.env.SESSION_SECRET),
      fingerprint(ip, c.env.SESSION_SECRET),
    ]);
    const now = Date.now();

    const [numberToday, numberWeek, ipToday, ipWeek] = await Promise.all([
      container.demoCalls.countByPhoneSince(phoneHash, now - DAY_MS),
      container.demoCalls.countByPhoneSince(phoneHash, now - WEEK_MS),
      container.demoCalls.countByIpSince(ipHash, now - DAY_MS),
      container.demoCalls.countByIpSince(ipHash, now - WEEK_MS),
    ]);

    /* the per-number answer is deliberately the same whether this visitor rang
     * it or somebody else did, so the demo cannot be used to find out whether
     * a number has been entered before */
    if (numberToday >= PER_DAY || numberWeek >= PER_WEEK) {
      return c.json({ error: 'this number has had its demo calls for now' }, 429);
    }
    if (ipToday >= PER_DAY || ipWeek >= PER_WEEK) {
      return c.json({ error: 'you have used your demo calls, sign up to get the real thing' }, 429);
    }

    /* The budget is the only ceiling on how fast this can run, on purpose.
     * There is no per-minute cap: if the page goes viral, the thing that should
     * stop the demo is running out of money, not an arbitrary window that
     * refuses people while the budget still has room.
     *
     * That is only safe because this is exact. One guarded statement, so a
     * thousand simultaneous requests cannot all be told yes. */
    const mills = costMills(costUsd);
    const budgetKey = budgetKeyFor(Date.now());
    if (!(await container.counters.spend(budgetKey, mills, budgetMills(c.env)))) {
      await warnBudgetSpent(container, c.env);
      return c.json({ error: 'the demo is out for this week' }, 429);
    }

    // recorded after the money is committed, so the audit row can never claim
    // spend the budget did not actually admit
    const demoId = await container.demoCalls.reserve({ phoneHash, ipHash, costUsd });

    /* Only the carrier call is guarded. markPlaced used to sit inside this try,
     * so a failure writing the provider id after Twilio had already accepted the
     * call would refund a call that was going to ring and be billed. */
    let placed: { providerCallId: string };
    try {
      placed = await container.telephony.placeCall({
        to: phone,
        from: c.env.TWILIO_FROM_NUMBER_US,
        answerUrl: await demoCallbackUrl(c.env, 'answer', demoId),
        hangupUrl: await demoCallbackUrl(c.env, 'hangup', demoId),
        ringTimeoutSeconds: RING_TIMEOUT_SECONDS,
      });
    } catch (error) {
      // the carrier refused, so nothing will be billed: hand the money back
      // rather than charging the week for a call that never rang
      await container.counters.refund(budgetKey, mills);
      await container.demoCalls.release(demoId);
      throw error;
    }
    await container.demoCalls.markPlaced(demoId, placed.providerCallId);

    logEvent('info', 'demo.call_placed', { demoId, costUsd, country: parsed.country ?? 'unknown' });
    // no callId handed back: there is nothing an anonymous caller can do with
    // it, and it would be an oracle for whether the number rang
    return c.json({ ok: true });
  });

async function verifyChallenge(token: string, secret: string, ip: string): Promise<boolean> {
  const { verifyTurnstile } = await import('../lib/turnstile');
  return verifyTurnstile(token, secret, ip, TURNSTILE_ACTION);
}

export async function demoCallbackUrl(env: Env, kind: 'answer' | 'hangup', demoId: string): Promise<string> {
  const origin = env.TELEPHONY_PUBLIC_ORIGIN || env.API_ORIGIN;
  const token = await signDemoToken(demoId, env.SESSION_SECRET);
  return `${origin}/hooks/demo/${kind}?demo=${demoId}&tok=${token}`;
}

export function signDemoToken(demoId: string, secret: string): Promise<string> {
  return hmacSign(`demo-callback:${demoId}`, secret);
}

/** tells us once per week-window that the demo has stopped, since the CTA
 * disappearing is otherwise silent */
async function warnBudgetSpent(container: Container, env: Env): Promise<void> {
  const bucket = Math.floor(Date.now() / WEEK_MS);
  if (!(await container.webhookEvents.claim(`demo-budget:${bucket}`, 'demo-budget'))) return;
  logEvent('warn', 'demo.weekly_budget_spent', { budgetUsd: weeklyBudgetUsd(env) });
  await container.notifier?.demoBudgetSpent(weeklyBudgetUsd(env));
}
