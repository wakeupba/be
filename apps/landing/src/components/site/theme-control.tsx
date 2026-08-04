'use client';

import {
  applyTheme,
  bindThemeHotkey,
  nextThemePref,
  readThemePref,
  THEME_MODES,
  type ThemePref,
  themeTransition,
  writeThemePref,
} from '@wakeupbabe/shared/theme';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const ICONS: Record<ThemePref, typeof Sun> = { system: Monitor, light: Sun, dark: Moon };
const LABELS: Record<ThemePref, string> = {
  system: 'System theme',
  light: 'Light theme',
  dark: 'Dark theme',
};

/** one cell, so the thumb can be positioned arithmetically */
const CELL = 28;

/*
 * The spoo theme switcher: a radiogroup pill with a sliding thumb, three
 * explicit states because "follow system" is what most people want and a
 * binary toggle cannot say it. Switching rides a View Transition so the page
 * cross-fades, and "d" flips light/dark, bound here because the footer this
 * sits in is mounted for the life of the page.
 *
 * Spoo animates the thumb with motion's layoutId. Here it is a transform
 * transition instead: this is a static marketing export whose weight is the
 * LCP, and an animation library for one control is not a trade worth making.
 */
export function ThemeControl() {
  // resolved after mount: the boot script owns the class before hydration, so
  // the server-rendered markup has no idea which theme is live
  const [pref, setPref] = useState<ThemePref | null>(null);
  const groupRef = useRef<HTMLDivElement>(null);

  useEffect(() => setPref(readThemePref()), []);

  const choose = useCallback((next: ThemePref) => {
    setPref(next);
    writeThemePref(next);
    themeTransition(() => applyTheme(next));
  }, []);

  useEffect(() => bindThemeHotkey(choose), [choose]);

  // on "system", keep following the OS instead of freezing today's answer
  useEffect(() => {
    if (pref !== 'system') return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => applyTheme('system');
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, [pref]);

  /* a radiogroup moves selection with the arrows and keeps one tab stop.
   * Focus has to follow the selection or the announcement never happens:
   * screen readers read the focused element, not the checked one. */
  function onGroupKeyDown(event: React.KeyboardEvent) {
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
    const back = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
    if (!forward && !back) return;
    event.preventDefault();
    const next = nextThemePref(pref, forward ? 1 : -1);
    choose(next);
    const radios = groupRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    radios?.[THEME_MODES.indexOf(next)]?.focus();
  }

  const index = pref === null ? -1 : THEME_MODES.indexOf(pref);

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label="Theme"
      onKeyDown={onGroupKeyDown}
      suppressHydrationWarning
      className="relative inline-flex h-8 items-center rounded-full border border-line bg-surface/60 p-0.5"
    >
      {index >= 0 && (
        <span
          aria-hidden
          className="absolute left-0.5 top-0.5 size-7 rounded-full bg-background shadow-bevel-secondary ring-1 ring-line transition-transform duration-300 ease-[cubic-bezier(0.34,1.4,0.64,1)] motion-reduce:transition-none"
          style={{ transform: `translateX(${index * CELL}px)` }}
        />
      )}
      {THEME_MODES.map((value) => {
        const Icon = ICONS[value];
        const active = pref === value;
        return (
          // biome-ignore lint/a11y/useSemanticElements: a native radio cannot host the sliding thumb; the roving tabindex, arrow-key selection and focus move it would have provided are implemented here
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={LABELS[value]}
            // one tab stop for the group, arrows move within it
            tabIndex={active || pref === null ? 0 : -1}
            suppressHydrationWarning
            onClick={() => {
              if (value === pref) return;
              choose(value);
            }}
            className={cn(
              'relative inline-flex size-7 items-center justify-center rounded-full transition-colors duration-150',
              active ? 'text-foreground' : 'text-muted-2 hover:text-foreground',
            )}
          >
            <Icon className="relative z-10 size-3.5" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
