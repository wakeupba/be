import { errorFields, logEvent } from './log';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

interface SiteVerifyResponse {
  success: boolean;
  action?: string;
  'error-codes'?: string[];
}

/**
 * Verifies a Turnstile token for the demo call endpoint.
 *
 * Returns false on anything unexpected, including a network failure talking to
 * Cloudflare. That is the deliberate direction: this guards the one route that
 * spends money for an anonymous visitor, so an unavailable challenge service
 * means no calls rather than free calls.
 *
 * The action is checked as well as the signature, and its absence counts as a
 * failure. Site keys are public, so anyone can render their own widget with
 * ours and mint a token; requiring the action we configured is what stops that
 * token being spent here.
 *
 * One consequence, worth knowing before debugging it a second time:
 * Cloudflare's always-passes testing keys return success with no action field
 * at all, so they cannot exercise this path. The happy path is covered by tests
 * that stub siteverify instead.
 */
export async function verifyTurnstile(
  token: string,
  secret: string,
  remoteIp: string | null,
  expectedAction: string,
): Promise<boolean> {
  const body = new FormData();
  body.set('secret', secret);
  body.set('response', token);
  // scopes the token to the address that solved it
  if (remoteIp && remoteIp !== 'local') body.set('remoteip', remoteIp);

  try {
    const response = await fetch(VERIFY_URL, { method: 'POST', body });
    if (!response.ok) {
      logEvent('warn', 'turnstile.verify_http_error', { status: response.status });
      return false;
    }
    const result = (await response.json()) as SiteVerifyResponse;
    if (!result.success) {
      logEvent('info', 'turnstile.rejected', { codes: result['error-codes'] ?? [] });
      return false;
    }
    if (result.action !== expectedAction) {
      logEvent('warn', 'turnstile.action_mismatch', { got: result.action ?? null, expectedAction });
      return false;
    }
    return true;
  } catch (error) {
    logEvent('error', 'turnstile.verify_failed', errorFields(error));
    return false;
  }
}
