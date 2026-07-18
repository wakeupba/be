import type { ReactNode } from 'react';
import { Shell } from './panel';

/*
 * Stat tile: label-mono zone, 26px tabular mono value, and a quiet footer
 * zone (never a pill). Loaded-but-empty shows an honest 0; a dash means
 * loading only. All tiles share the same height via the footer strip.
 */
export function Kpi({
  label,
  value,
  sub,
  footer,
}: {
  label: string;
  value: string;
  sub?: string;
  footer: ReactNode;
}) {
  return (
    <Shell>
      <div className="flex h-full flex-col">
        <div className="px-4 pt-3.5 pb-3">
          <p className="label-mono truncate text-muted-foreground">{label}</p>
        </div>
        <div className="flex grow items-baseline gap-1.5 px-4 pb-4">
          <p className="font-mono text-[26px] font-semibold leading-none tracking-tight tabular-nums">
            {value}
          </p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div className="flex h-8 items-center rounded-b-[14px] border-t border-border/60 bg-muted/30 px-4">
          <p className="font-mono text-[11px] tabular-nums text-muted-foreground/70">{footer}</p>
        </div>
      </div>
    </Shell>
  );
}
