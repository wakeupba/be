/*
 * Theme preference. Stored in a cookie rather than localStorage so the
 * landing page on the apex and the dashboard on app. agree: a user who picks
 * dark on one must not meet a white page on the other.
 *
 * "system" is the absence of a pinned choice, so it keeps following the OS
 * after the fact instead of freezing whatever the OS said at the time.
 */

export type ThemePref = 'system' | 'light' | 'dark';

export const THEME_COOKIE = 'wub_theme';
const ONE_YEAR = 60 * 60 * 24 * 365;

export function readThemePref(): ThemePref {
  if (typeof document === 'undefined') return 'system';
  const raw = document.cookie
    .split('; ')
    .find((part) => part.startsWith(`${THEME_COOKIE}=`))
    ?.slice(THEME_COOKIE.length + 1);
  return raw === 'light' || raw === 'dark' ? raw : 'system';
}

export function writeThemePref(pref: ThemePref): void {
  // the apex zone owns the cookie in production; local dev is host-only
  const onBrandDomain = document.location.hostname.endsWith('wakeupba.be');
  const domain = onBrandDomain ? '; Domain=.wakeupba.be' : '';
  const secure = document.location.protocol === 'https:' ? '; Secure' : '';
  const value = pref === 'system' ? '' : pref;
  const maxAge = pref === 'system' ? 0 : ONE_YEAR;
  // biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API is still absent in Safari, and this writes a first-party literal
  document.cookie = `${THEME_COOKIE}=${value}; Path=/; Max-Age=${maxAge}; SameSite=Lax${domain}${secure}`;
}

export function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function applyTheme(pref: ThemePref): void {
  const dark = pref === 'dark' || (pref === 'system' && systemPrefersDark());
  document.documentElement.classList.toggle('dark', dark);
}

/**
 * Runs as a blocking inline script before first paint, so a dark-mode user
 * never sees a white flash. Kept tiny and dependency free on purpose: it has
 * to execute before the bundle exists. Mirrors the logic above.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark)/);var p=m&&m[1];var d=p==='dark'||(!p&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark')}catch(e){}})()`;
