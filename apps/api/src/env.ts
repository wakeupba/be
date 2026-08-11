export interface Env {
  DB: D1Database;

  APP_ORIGIN: string;
  API_ORIGIN: string;
  LANDING_ORIGIN: string;
  COOKIE_DOMAIN: string;
  /* Twilio rejects non-public callback URLs (error 21205), so when
   * API_ORIGIN is localhost, call placement needs the tunnel origin here.
   * Unset in production, where API_ORIGIN is already public. */
  TELEPHONY_PUBLIC_ORIGIN?: string;

  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  SESSION_SECRET: string;
  TOKEN_ENC_KEY: string;
  TWILIO_ACCOUNT_SID: string;
  TWILIO_AUTH_TOKEN: string;
  TWILIO_FROM_NUMBER_US: string;
  DODO_WEBHOOK_SECRET: string;

  /* billing stays dark until all three are configured */
  DODO_API_KEY?: string;
  DODO_ENVIRONMENT?: 'test_mode' | 'live_mode';
  DODO_PRODUCT_RIDE_OR_DIE?: string;
  DODO_PRODUCT_TOPUP?: string;
  /* '1' swaps Dodo's hosted pages for local fakes; dev only, and ignored
   * outright whenever a real API key is present */
  DODO_FAKE_CHECKOUT?: string;

  /* error tracking stays dark until set */
  SENTRY_DSN?: string;

  /* transactional email stays dark until set */
  RESEND_API_KEY?: string;

  /* product analytics (PostHog), server-side capture only; stays dark until
   * the key is set. Host defaults to US cloud. */
  POSTHOG_API_KEY?: string;
  POSTHOG_HOST?: string;

  /* The landing demo call. Both are required for it to exist at all: without a
   * challenge secret the endpoint refuses, and with a budget of zero there is
   * nothing to spend, so the CTA never renders. Fail closed by construction. */
  TURNSTILE_SECRET?: string;
  DEMO_WEEKLY_BUDGET_USD?: string;

  /* where operational mail goes; falls back to the sending address */
  OWNER_EMAIL?: string;
}
