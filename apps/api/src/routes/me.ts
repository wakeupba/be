import {
  type CallHistoryDto,
  type FeatureCardDto,
  LEAD_MINUTE_OPTIONS,
  type LeadMinutes,
  type MeDto,
  PLAN_LIMITS,
  UPCOMING_FEATURES,
  type UpcomingEventDto,
} from '@wakeupbabe/shared';
import { Hono } from 'hono';
import type { Container } from '../container';
import type { Env } from '../env';

const E164_PATTERN = /^\+[1-9]\d{6,14}$/;
const GOOGLE_COLOR_IDS = new Set(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11']);
const VERIFY_CALLS_PER_HOUR = 3;

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
    const { users } = c.get('container');
    const user = await users.findById(c.get('userId'));
    if (!user) return c.json({ error: 'not found' }, 404);
    const dto: MeDto = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      phone: user.phoneE164,
      plan: user.plan,
      callsUsed: user.callsUsedThisPeriod,
      callsLimit: PLAN_LIMITS[user.plan].callsPerMonth,
      extraCredits: user.extraCallCredits,
      triggerColorId: user.triggerColorId,
      leadMinutes: user.leadMinutes,
      timezone: user.timezone,
      dndVerified: user.dndVerifiedAt !== null,
    };
    return c.json(dto);
  })

  .patch('/me/settings', async (c) => {
    const { users } = c.get('container');
    const body = await c.req.json<Record<string, unknown>>().catch(() => null);
    if (!body) return c.json({ error: 'invalid json' }, 400);

    const patch: Parameters<typeof users.updateSettings>[1] = {};

    if (body.phone !== undefined) {
      if (typeof body.phone !== 'string' || !E164_PATTERN.test(body.phone)) {
        return c.json({ error: 'phone must be E.164, like +14155550123' }, 400);
      }
      patch.phoneE164 = body.phone;
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
    const { calls } = c.get('container');
    const rows = await calls.listHistoryForUser(c.get('userId'));
    const dtos: CallHistoryDto[] = rows.map((row) => ({
      id: row.id,
      eventTitle: row.eventTitle,
      attempt: row.attempt,
      placedAt: row.placedAt,
      outcome: row.outcome,
      isTest: row.isTest,
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
