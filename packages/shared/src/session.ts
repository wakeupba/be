import { hmacVerify } from './crypto';

export const SESSION_COOKIE = 'wub_session';

interface SessionPayload {
  userId: string;
  expiresAt: number;
}

/*
 * Verify-only session read. Cookie minting stays in the api; this lives in
 * shared so the dashboard gate worker can authenticate document requests
 * with the same SESSION_SECRET before serving any HTML.
 */
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
