import { errorFields, logEvent } from '../lib/log';

/*
 * Product analytics, server-side only. The landing page's privacy policy
 * promises no third-party anything in the browser, so the funnel is captured
 * where it actually happens: in this worker, keyed by our own user ids. No
 * emails, no phone numbers, no client scripts — country codes and plan names
 * are as personal as an event gets.
 *
 * Fails dark like every optional integration here: without a key the
 * container wires the noop, and a PostHog outage costs a log line, never a
 * request. Captures are awaited (they never throw), which keeps ordering
 * obvious and costs one intra-region HTTP call on paths that are already
 * doing several.
 */
export interface Analytics {
  capture(distinctId: string, event: string, properties?: Record<string, unknown>): Promise<void>;
}

export class NoopAnalytics implements Analytics {
  async capture(): Promise<void> {}
}

export class PostHogAnalytics implements Analytics {
  constructor(
    private readonly apiKey: string,
    private readonly host: string,
  ) {}

  async capture(distinctId: string, event: string, properties: Record<string, unknown> = {}): Promise<void> {
    try {
      const response = await fetch(`${this.host}/i/v0/e/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: this.apiKey,
          event,
          distinct_id: distinctId,
          properties,
          timestamp: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) {
        logEvent('warn', 'analytics.capture_failed', { event, status: response.status });
      }
    } catch (error) {
      logEvent('warn', 'analytics.capture_failed', { event, ...errorFields(error) });
    }
  }
}
