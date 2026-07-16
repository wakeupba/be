import { Hono } from 'hono';
import type { Container } from '../container';
import { createDb } from '../db/client';
import { waitlist } from '../db/schema';
import type { Env } from '../env';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGIONS = new Set(['Europe', 'United Kingdom', 'India', 'Australia', 'Other']);

type WaitlistContext = { Bindings: Env; Variables: { container: Container } };

export const waitlistRoutes = new Hono<WaitlistContext>().post('/', async (c) => {
  const body = await c.req.json<{ email?: string; region?: string }>().catch(() => null);
  if (!body) return c.json({ error: 'invalid json' }, 400);

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : '';
  const region = typeof body.region === 'string' ? body.region : '';
  if (!EMAIL_PATTERN.test(email)) return c.json({ error: 'invalid email' }, 400);
  if (!REGIONS.has(region)) return c.json({ error: 'unknown region' }, 400);

  await createDb(c.env.DB)
    .insert(waitlist)
    .values({ email, region, createdAt: Date.now() })
    .onConflictDoNothing();

  return c.json({ ok: true });
});
