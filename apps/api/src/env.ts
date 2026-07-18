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
  TWILIO_ACCOUNT_SID: string;
  TWILIO_AUTH_TOKEN: string;
  TWILIO_FROM_NUMBER_US: string;
  DODO_WEBHOOK_SECRET: string;
}
