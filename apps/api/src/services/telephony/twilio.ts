import type { PlaceCallInput, PlacedCall, TelephonyProvider } from './provider';

const TWILIO_API_BASE = 'https://api.twilio.com/2010-04-01/Accounts';

export class TwilioProvider implements TelephonyProvider {
  readonly name = 'twilio';

  constructor(
    private readonly accountSid: string,
    private readonly authToken: string,
  ) {}

  async placeCall(input: PlaceCallInput): Promise<PlacedCall> {
    const body = new URLSearchParams({
      To: input.to,
      From: input.from,
      Url: input.answerUrl,
      Method: 'POST',
      StatusCallback: input.hangupUrl,
      StatusCallbackMethod: 'POST',
      Timeout: String(input.ringTimeoutSeconds),
    });

    const response = await fetch(`${TWILIO_API_BASE}/${this.accountSid}/Calls.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${this.accountSid}:${this.authToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`twilio call failed: ${response.status} ${detail}`);
    }
    const data = (await response.json()) as { sid?: string };
    if (!data.sid) throw new Error('twilio response missing call sid');
    return { providerCallId: data.sid };
  }

  /**
   * X-Twilio-Signature: base64(HMAC-SHA1(auth_token, url + concat(sorted form
   * key+value pairs))). Rejecting unsigned or mis-signed webhooks means only
   * Twilio can drive our call state machine.
   */
  async verifyWebhook(request: Request): Promise<boolean> {
    const signature = request.headers.get('X-Twilio-Signature');
    if (!signature) return false;

    let payload = request.url;
    const contentType = request.headers.get('Content-Type') ?? '';
    if (request.method === 'POST' && contentType.includes('application/x-www-form-urlencoded')) {
      const form = await request.clone().formData();
      const keys = [...form.keys()].sort();
      for (const key of keys) payload += key + String(form.get(key) ?? '');
    }

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(this.authToken),
      { name: 'HMAC', hash: 'SHA-1' },
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
