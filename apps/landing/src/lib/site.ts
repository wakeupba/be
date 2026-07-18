/* dev points at the local dashboard; production builds bake in the real app
 * origin (override with NEXT_PUBLIC_APP_ORIGIN at build time) */
export const APP_URL =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:3001'
    : (process.env.NEXT_PUBLIC_APP_ORIGIN ?? 'https://app.wakeupba.be');
