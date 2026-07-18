import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/* the machined frame: hairline, 2px shell gutter, hairline; inner radius =
 * outer radius minus padding so corners stay concentric */
export function Shell({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('rounded-2xl border border-border/60 bg-shell p-0.5', className)}>
      <div className="h-full rounded-[14px] bg-background">{children}</div>
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

/* one section grammar: bare label-mono heading on the canvas, optional action */
export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex h-9 items-center justify-between">
      <p className="label-mono text-muted-foreground">{title}</p>
      {action}
    </div>
  );
}
