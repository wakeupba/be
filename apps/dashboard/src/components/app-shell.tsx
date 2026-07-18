'use client';

import type { MeDto } from '@wakeupbabe/shared';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { BabeMark } from '@/components/brand/mark';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/', label: 'Overview' },
  { href: '/settings/', label: 'Settings' },
  { href: '/roadmap/', label: 'Roadmap' },
];

/* the floating-sheet architecture: canvas floor, elevated rounded content
 * sheet with its own sticky topbar */
export function AppShell({ me, children }: { me: MeDto | null; children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-canvas p-3">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-2xl border border-border bg-background shadow-card">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-border/60 bg-background px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <a href="/" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
              <BabeMark className="size-6" />
              Wake Up Babe
            </a>
            {me && (
              <nav className="hidden items-center gap-1 sm:flex">
                {NAV.map((item) => {
                  const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'rounded-lg px-2.5 py-1.5 text-[13px] transition-colors duration-150',
                        active
                          ? 'bg-muted text-foreground'
                          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                      )}
                    >
                      {item.label}
                    </a>
                  );
                })}
              </nav>
            )}
          </div>
          {me && (
            <div className="flex items-center gap-3">
              <p className="hidden font-mono text-[11px] tabular-nums text-muted-foreground/70 md:block">
                {me.callsUsed}/{me.callsLimit} calls
              </p>
              <button
                type="button"
                onClick={async () => {
                  await api.logout();
                  window.location.reload();
                }}
                className="rounded-lg px-2.5 py-1.5 text-[13px] text-muted-foreground transition-colors duration-150 hover:bg-muted/60 hover:text-foreground"
              >
                Sign out
              </button>
            </div>
          )}
        </header>
        <main className="flex flex-1 flex-col px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
