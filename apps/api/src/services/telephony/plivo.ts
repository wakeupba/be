import type { PlaceCallInput, PlacedCall, TelephonyProvider } from './provider';

const PLIVO_API_BASE = 'https://api.plivo.com/v1/Account';

export class PlivoProvider implements TelephonyProvider {
  readonly name = 'plivo';

  constructor(
    private readonly authId: string,
    private readonly authToken: string,
  ) {}

  async placeCall(input: PlaceCallInput): Promise<PlacedCall> {
    const response = await fetch(`${PLIVO_API_BASE}/${this.authId}/Call/`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${this.authId}:${this.authToken}`)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: input.to,
        from: input.from,
        answer_url: input.answerUrl,
        answer_method: 'POST',
        hangup_url: input.hangupUrl,
        hangup_method: 'POST',
        ring_timeout: input.ringTimeoutSeconds,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`plivo call failed: ${response.status} ${body}`);
    }
    const data = (await response.json()) as { request_uuid?: string };
    if (!data.request_uuid) throw new Error('plivo response missing request_uuid');
    return { providerCallId: data.request_uuid };
  }

  /**
   * Plivo signature V2: base64(HMAC-SHA256(auth_token, callback_url + nonce)).
   * Rejecting unsigned or mis-signed webhooks means only Plivo can drive our
   * call state machine.
   */
  async verifyWebhook(request: Request): Promise<boolean> {
    const signature = request.headers.get('X-Plivo-Signature-V2');
    const nonce = request.headers.get('X-Plivo-Signature-V2-Nonce');
    if (!signature || !nonce) return false;

    // V2 signs the callback URL exactly as we configured it, query string included
    const payload = request.url + nonce;

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(this.authToken),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
    const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));

    if (expected.length !== signature.length) return false;
    let mismatch = 0;
    for (let i = 0; i < expected.length; i++) {
      mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
    }
    return mismatch === 0;
  }
}
