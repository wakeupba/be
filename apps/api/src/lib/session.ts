import { hmacSign, hmacVerify } from './crypto';

const SESSION_COOKIE = 'wub_session';
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

export async function readSession(cookieHeader: string | undefined, secret: string): Promise<string | null> {
  if (!cookieHeader) return null;
  const raw = cookieHeader.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))?.[1];
  if (!raw) return null;
  const [body, signature] = raw.split('.');
  if (!body || !signature) return null;
  if (!(await hmacVerify(body, signature, secret))) return null;
  try {
    const payload = JSON.parse(atob(body)) as SessionPayload;
    if (payload.expiresAt < Date.now()) return null;
    return payload.userId;
  } catch {
    return null;
  }
}
