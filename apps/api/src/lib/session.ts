import { hmacSign, SESSION_COOKIE } from '@wakeupbabe/shared';

// verification is shared with the dashboard gate worker
export { readSession } from '@wakeupbabe/shared';

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

interface SessionPayload {
  userId: string;
  expiresAt: number;
}

export async function createSessionCookie(
  userId: string,
  secret: string,
  cookieDomain: string,
): Promise<string> {
  const payload: SessionPayload = { userId, expiresAt: Date.now() + SESSION_TTL_MS };
  const body = btoa(JSON.stringify(payload));
  const signature = await hmacSign(body, secret);
  const value = `${body}.${signature}`;
  const attributes = [
    `${SESSION_COOKIE}=${value}`,
    `Domain=${cookieDomain}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  return attributes.join('; ');
}

export function clearSessionCookie(cookieDomain: string): string {
  return `${SESSION_COOKIE}=; Domain=${cookieDomain}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
