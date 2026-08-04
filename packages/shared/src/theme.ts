/*
 * Theme preference. Stored in a cookie rather than localStorage so the
 * landing page on the apex and the dashboard on app. agree: a user who picks
 * dark on one must not meet a white page on the other.
 *
 * "system" is the absence of a pinned choice, so it keeps following the OS
 * after the fact instead of freezing whatever the OS said at the time.
 */

export type ThemePref = 'system' | 'light' | 'dark';

/** the order the switcher presents, and the order arrow keys walk */
export const THEME_MODES: readonly ThemePref[] = ['system', 'light', 'dark'];

/**
 * Wrapping neighbour in THEME_MODES. Lives here so the two switchers cannot
 * drift, since the index arithmetic was byte-identical in both.
 */
export function nextThemePref(current: ThemePref | null, direction: 1 | -1): ThemePref {
  const at = current === null ? 0 : THEME_MODES.indexOf(current);
  const index = (Math.max(at, 0) + (direction === 1 ? 1 : THEME_MODES.length - 1)) % THEME_MODES.length;
  return THEME_MODES[index] ?? 'system';
}

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

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { ready: Promise<void> };
};

/**
 * Wraps a theme switch in a View Transition so the browser cross-fades the
 * whole page instead of snapping. Falls back to an instant switch where the
 * API is missing or the user asked for less motion. Ported from spoo, minus
 * next-themes: the caller passes whatever applies the change, and React's
 * flushSync is not needed because applyTheme touches the DOM directly.
 */
export function themeTransition(apply: () => void): void {
  const doc = document as ViewTransitionDocument;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!doc.startViewTransition || reduce) {
    apply();
    return;
  }
  // ready rejects when a transition is skipped, which is what a second one
  // starting first does (double-tapping the hotkey). Nothing here needs to
  // know, but an unobserved rejection reaches the console.
  doc.startViewTransition(apply).ready.catch(() => {});
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  );
}

/**
 * "d" toggles light and dark, the hidden keyboard bit spoo ships. Ignores
 * modifier combinations and anything typed into a field, so it never eats a
 * "d" meant for an input. Returns its own teardown.
 */
export function bindThemeHotkey(onToggle: (next: 'light' | 'dark') => void): () => void {
  function onKeyDown(event: KeyboardEvent) {
    if (event.defaultPrevented || event.repeat) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key.toLowerCase() !== 'd') return;
    if (isTypingTarget(event.target)) return;
    onToggle(document.documentElement.classList.contains('dark') ? 'light' : 'dark');
  }
  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}

/**
 * Runs as a blocking inline script before first paint, so a dark-mode user
 * never sees a white flash. Kept tiny and dependency free on purpose: it has
 * to execute before the bundle exists. Mirrors the logic above.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark)/);var p=m&&m[1];var d=p==='dark'||(!p&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark')}catch(e){}})()`;
