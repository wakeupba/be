export interface Env {
  DB: D1Database;

  APP_ORIGIN: string;
  API_ORIGIN: string;
  LANDING_ORIGIN: string;
  COOKIE_DOMAIN: string;

  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  SESSION_SECRET: string;
  TOKEN_ENC_KEY: string;
  PLIVO_AUTH_ID: string;
  PLIVO_AUTH_TOKEN: string;
  PLIVO_FROM_NUMBER_US: string;
  DODO_WEBHOOK_SECRET: string;
}
