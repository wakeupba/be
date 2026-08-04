/* dev points at the local dashboard; production builds bake in the real app
 * origin (override with NEXT_PUBLIC_APP_ORIGIN at build time) */
export const APP_URL =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:3001'
    : (process.env.NEXT_PUBLIC_APP_ORIGIN ?? 'https://app.wakeupba.be');

/* The one true origin. Every canonical, sitemap entry and JSON-LD @id is built
 * from this, so the apex and www never disagree about who they are. www is a
 * custom domain on the same asset worker and serves byte-identical HTML, and a
 * static export cannot redirect by host — the canonical tag is what tells
 * Google which one counts. See README for the Cloudflare redirect rule that
 * closes the gap properly. */
export const SITE_URL = 'https://wakeupba.be';

export const SITE_NAME = 'Wake Up Babe';

export const GITHUB_URL = 'https://github.com/wakeupba/be';

export const SUPPORT_EMAIL = 'hey@wakeupba.be';

/* One sentence, used as the default description and the JSON-LD one. Kept here
 * so the meta tag and the structured data can never drift apart. */
export const SITE_TAGLINE =
  'Wake Up Babe calls your phone before the Google Calendar meetings you mark as important, straight through Do Not Disturb. Notifications get ignored. Phone calls get answered.';

/* trailingSlash is on, so canonicals carry the slash too. Without it Google
 * sees the canonical and the URL it actually resolves to as two addresses. */
export function canonicalPath(path: string): string {
  if (path === '/') return '/';
  const trimmed = path.replace(/^\/+|\/+$/g, '');
  return `/${trimmed}/`;
}

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${canonicalPath(path)}`;
}

/* Every indexable route, with the date its content last meaningfully changed.
 *
 * These are hand-maintained on purpose. Stamping `new Date()` at build time
 * tells Google every page changed on every deploy, which is the fastest way to
 * get your lastmod ignored entirely. Bump a date only when the copy changes. */
interface RouteMeta {
  path: string;
  lastModified: string;
  priority: number;
  changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
}

export const ROUTES: RouteMeta[] = [
  { path: '/', lastModified: '2026-08-04', priority: 1, changeFrequency: 'weekly' },
  { path: '/pricing/', lastModified: '2026-08-04', priority: 0.9, changeFrequency: 'monthly' },
  {
    path: '/google-calendar-phone-call-reminders/',
    lastModified: '2026-08-04',
    priority: 0.8,
    changeFrequency: 'monthly',
  },
  {
    path: '/do-not-disturb-meeting-reminders/',
    lastModified: '2026-08-04',
    priority: 0.8,
    changeFrequency: 'monthly',
  },
  {
    path: '/calendar-reminder-alternatives/',
    lastModified: '2026-08-04',
    priority: 0.7,
    changeFrequency: 'monthly',
  },
  { path: '/privacy/', lastModified: '2026-08-04', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/terms/', lastModified: '2026-08-04', priority: 0.3, changeFrequency: 'yearly' },
];
