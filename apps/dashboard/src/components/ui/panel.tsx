import type { Icon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/* the machined frame: hairline, 2px shell gutter, hairline; inner radius =
 * outer radius minus padding so corners stay concentric. The face is --card
 * rather than --background, so a framed tile reads as sitting on the page
 * sheet instead of dissolving into it (identical in light, where both are
 * white; the distinction only exists in dark) */
export function Shell({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('rounded-2xl border border-border/60 bg-shell p-0.5', className)}>
      <div className="h-full rounded-[14px] bg-card">{children}</div>
    </div>
  );
}

/* plain bordered panel for rows and lists */
export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('overflow-hidden rounded-xl border border-border/60 bg-card', className)}>
      {children}
    </div>
  );
}

/* one section grammar: label-mono heading on the canvas, optional leading
 * icon and trailing action */
export function SectionHeader({
  title,
  icon: IconGlyph,
  action,
}: {
  title: string;
  icon?: Icon;
  action?: ReactNode;
}) {
  return (
    <div className="flex h-9 items-center justify-between">
      <p className="flex items-center gap-1.5 label-mono text-muted-foreground">
        {IconGlyph && <IconGlyph size={13} className="shrink-0 text-muted-foreground/70" aria-hidden />}
        {title}
      </p>
      {action}
    </div>
  );
}
