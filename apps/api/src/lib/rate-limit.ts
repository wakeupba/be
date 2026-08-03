import type { Container } from '../container';

/**
 * Fixed-window rate limiting riding on the webhook-events claims table
 * (rows are pruned by the cron sweep). Claiming one of `limit` slots in the
 * current window goes through the table's primary key, so concurrent
 * requests cannot exceed the cap even across isolates. False = limited.
 */
export async function claimRateSlot(
  container: Container,
  key: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const bucket = Math.floor(Date.now() / windowMs);
  for (let slot = 0; slot < limit; slot++) {
    if (await container.webhookEvents.claim(`rl:${key}:${bucket}:${slot}`, 'rate-limit')) return true;
  }
  return false;
}

/** the client ip for public-endpoint limits; cloudflare always sets the
 * header in production, local dev falls through to one shared bucket */
export function clientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') ?? 'local';
}
