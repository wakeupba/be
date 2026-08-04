'use client';

import { applyTheme, readThemePref, type ThemePref, writeThemePref } from '@wakeupbabe/shared/theme';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

const OPTIONS: Array<{ pref: ThemePref; label: string; icon: typeof Sun }> = [
  { pref: 'system', label: 'System theme', icon: Monitor },
  { pref: 'light', label: 'Light theme', icon: Sun },
  { pref: 'dark', label: 'Dark theme', icon: Moon },
];

/*
 * Three explicit states, not a toggle: "system" is what most people want and
 * a binary switch cannot express it. The preference is a cookie on the apex
 * domain, so a choice made here is already in force inside the app.
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
    <div className="flex items-center">
      <div className="flex items-center gap-0.5 rounded-md border border-line-soft bg-surface p-0.5">
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
                selected
                  ? 'bg-background text-foreground shadow-bevel-secondary'
                  : 'text-muted-2 hover:text-foreground',
              )}
            >
              <option.icon size={12} className="relative" aria-hidden />
            </button>
          );
        })}
      </div>
    </div>
  );
}
