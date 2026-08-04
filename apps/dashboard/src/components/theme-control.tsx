'use client';

import { Desktop, Moon, Sun } from '@phosphor-icons/react';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { applyTheme, readThemePref, type ThemePref, writeThemePref } from '@/lib/theme';
import { cn } from '@/lib/utils';

const OPTIONS: Array<{ pref: ThemePref; label: string; icon: typeof Sun }> = [
  { pref: 'system', label: 'System theme', icon: Desktop },
  { pref: 'light', label: 'Light theme', icon: Sun },
  { pref: 'dark', label: 'Dark theme', icon: Moon },
];

/*
 * Three explicit states, not a toggle: "system" is what most people want and
 * a binary switch cannot express it. Segmented control, same anatomy as the
 * lead-time picker, so the app has one grammar for "pick one of a few".
 */
export function ThemeControl() {
  // resolved after mount: the boot script owns the class before hydration,
  // and the server-rendered html has no idea which theme is live
  const [pref, setPref] = useState<ThemePref | null>(null);

  useEffect(() => setPref(readThemePref()), []);

  // on "system", keep following the OS instead of freezing today's answer
  useEffect(() => {
    if (pref !== 'system') return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => applyTheme('system');
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, [pref]);

  function choose(next: ThemePref) {
    setPref(next);
    writeThemePref(next);
    applyTheme(next);
  }

  return (
    <div className="flex items-center justify-between gap-2 px-1.5 py-1">
      <span className="text-xs text-muted-foreground">Theme</span>
      <div className="flex items-center gap-0.5 rounded-md bg-muted/60 p-0.5">
        {OPTIONS.map((option) => {
          const selected = pref === option.pref;
          return (
            <button
              key={option.pref}
              type="button"
              aria-label={option.label}
              aria-pressed={selected}
              onClick={() => choose(option.pref)}
              className={cn(
                'relative flex size-6 items-center justify-center rounded transition-colors duration-150',
                selected ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {selected && (
                <motion.span
                  layoutId="theme-thumb"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  className="absolute inset-0 rounded border border-border/60 bg-card"
                  aria-hidden
                />
              )}
              <option.icon
                size={12}
                weight={selected ? 'fill' : 'regular'}
                className="relative"
                aria-hidden
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
