import { hmacSign, readSession, SESSION_COOKIE, toBase64Url } from '@wakeupbabe/shared';
import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret } from '../src/lib/crypto';
import { verifyStandardWebhook } from '../src/routes/hooks';
import { signCallbackToken } from '../src/services/calls/dispatcher';

const ENC_KEY = 'dGVzdC1rZXktbXVzdC1iZS0zMi1ieXRlcy1sb25nISE';

describe('secret encryption', () => {
  it('round-trips a secret', async () => {
    const packed = await encryptSecret('refresh-token-value', ENC_KEY);
    expect(packed).not.toContain('refresh-token-value');
    expect(await decryptSecret(packed, ENC_KEY)).toBe('refresh-token-value');
  });

  it('refuses the wrong key', async () => {
    const otherKey = toBase64Url(new TextEncoder().encode('another-32-byte-length-key!!!!!!'));
    const packed = await encryptSecret('refresh-token-value', ENC_KEY);
    await expect(decryptSecret(packed, otherKey)).rejects.toThrow();
  });
});

describe('session cookies', () => {
  async function mint(userId: string, expiresAt: number, secret: string): Promise<string> {
    const body = btoa(JSON.stringify({ userId, expiresAt }));
    return `${SESSION_COOKIE}=${body}.${await hmacSign(body, secret)}`;
  }

  it('reads a valid session', async () => {
    const cookie = await mint('usr_1', Date.now() + 60_000, 's3cret');
    expect(await readSession(cookie, 's3cret')).toBe('usr_1');
  });

  it('rejects an expired session', async () => {
    const cookie = await mint('usr_1', Date.now() - 1, 's3cret');
    expect(await readSession(cookie, 's3cret')).toBeNull();
  });

  it('rejects a tampered payload', async () => {
    const cookie = await mint('usr_1', Date.now() + 60_000, 's3cret');
    const forgedBody = btoa(JSON.stringify({ userId: 'usr_2', expiresAt: Date.now() + 60_000 }));
    const forged = cookie.replace(/=[^.]+\./, `=${forgedBody}.`);
    expect(await readSession(forged, 's3cret')).toBeNull();
  });

  it('rejects a wrong-secret signature', async () => {
    const cookie = await mint('usr_1', Date.now() + 60_000, 'wrong');
    expect(await readSession(cookie, 's3cret')).toBeNull();
  });
});

describe('telephony callback tokens', () => {
  it('signs deterministically per call and secret', async () => {
    const a = await signCallbackToken('call_1', 'secret');
    expect(await signCallbackToken('call_1', 'secret')).toBe(a);
    expect(await signCallbackToken('call_2', 'secret')).not.toBe(a);
    expect(await signCallbackToken('call_1', 'other')).not.toBe(a);
  });
});

describe('dodo webhook signature (Standard Webhooks)', () => {
  const secret = `whsec_${btoa('dodo-webhook-signing-key')}`;

  async function sign(id: string, timestamp: number, body: string): Promise<string> {
    const keyBytes = Uint8Array.from(atob(secret.slice(6)), (ch) => ch.charCodeAt(0));
    const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, [
      'sign',
    ]);
    const mac = await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(`${id}.${timestamp}.${body}`),
    );
    return btoa(String.fromCharCode(...new Uint8Array(mac)));
  }

  function request(headers: Record<string, string>): Request {
    return new Request('https://api.test/hooks/dodo', { method: 'POST', headers });
  }

  it('accepts a correctly signed payload', async () => {
    const body = '{"type":"payment.succeeded"}';
    const ts = Math.floor(Date.now() / 1000);
    const signature = await sign('msg_1', ts, body);
    const req = request({
      'webhook-id': 'msg_1',
      'webhook-timestamp': String(ts),
      'webhook-signature': `v1,${signature}`,
    });
    expect(await verifyStandardWebhook(req, body, secret)).toBe(true);
  });

  it('rejects a tampered body', async () => {
    const ts = Math.floor(Date.now() / 1000);
    const signature = await sign('msg_1', ts, '{"amount":1}');
    const req = request({
      'webhook-id': 'msg_1',
      'webhook-timestamp': String(ts),
      'webhook-signature': `v1,${signature}`,
    });
    expect(await verifyStandardWebhook(req, '{"amount":9999}', secret)).toBe(false);
  });

  it('rejects replays older than five minutes', async () => {
    const body = '{}';
    const ts = Math.floor(Date.now() / 1000) - 600;
    const signature = await sign('msg_1', ts, body);
    const req = request({
      'webhook-id': 'msg_1',
      'webhook-timestamp': String(ts),
      'webhook-signature': `v1,${signature}`,
    });
    expect(await verifyStandardWebhook(req, body, secret)).toBe(false);
  });

  it('rejects missing headers', async () => {
    expect(await verifyStandardWebhook(request({}), '{}', secret)).toBe(false);
  });
});
