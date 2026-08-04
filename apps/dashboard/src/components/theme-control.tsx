'use client';

import { Desktop, Moon, Sun } from '@phosphor-icons/react';
import {
  applyTheme,
  nextThemePref,
  readThemePref,
  THEME_MODES,
  type ThemePref,
  themeTransition,
  writeThemePref,
} from '@wakeupbabe/shared/theme';
import { motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const ICONS: Record<ThemePref, typeof Sun> = { system: Desktop, light: Sun, dark: Moon };
const LABELS: Record<ThemePref, string> = {
  system: 'System theme',
  light: 'Light theme',
  dark: 'Dark theme',
};

/*
 * The spoo theme switcher: a radiogroup pill with a spring thumb, three
 * explicit states because "follow system" is what most people want and a
 * binary toggle cannot say it. Switching rides a View Transition so the page
 * cross-fades.
 *
 * Presentational on purpose. The "d" hotkey is bound once in AppShell, which
 * is always mounted; binding it here would make the shortcut live only while
 * the account flyout is open, which is exactly when the control is already
 * under the cursor.
 */
export function ThemeControl({ thumbId = 'theme-thumb' }: { thumbId?: string }) {
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

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label="Theme"
      onKeyDown={onGroupKeyDown}
      suppressHydrationWarning
      className="inline-flex h-8 items-center rounded-full border border-border/60 bg-background/40 p-0.5"
    >
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
              active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {active && (
              <motion.span
                layoutId={thumbId}
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                className="absolute inset-0 rounded-full bg-muted/60 shadow-soft ring-1 ring-border/80 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                aria-hidden
              />
            )}
            <Icon size={14} weight={active ? 'fill' : 'regular'} className="relative z-10" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
