'use client';

import type { MeDto } from '@wakeupbabe/shared';
import { House, LogOut, Map as MapIcon, Settings2 } from 'lucide-react';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { BabeMark } from '@/components/brand/mark';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/', label: 'Overview', icon: House },
  { href: '/settings/', label: 'Settings', icon: Settings2 },
  { href: '/roadmap/', label: 'Roadmap', icon: MapIcon },
];

/*
 * Real-dashboard architecture: a sidebar living on the canvas floor beside an
 * elevated content sheet with its own sticky topbar and scroll.
 */
export function AppShell({ me, title, children }: { me: MeDto | null; title?: string; children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-dvh overflow-hidden bg-canvas">
      {/* sidebar: canvas-level chrome, hidden on small screens */}
      <aside className="hidden w-60 shrink-0 flex-col px-3 py-4 lg:flex">
        <a href="/" className="flex items-center gap-2 px-2 text-[15px] font-semibold tracking-tight">
          <BabeMark className="size-6" />
          Wake Up Babe
        </a>

        <nav className="mt-6 flex flex-col gap-0.5">
          {NAV.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <a
                key={item.href}
                href={me ? item.href : '/'}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] transition-colors duration-150',
                  active
                    ? 'border border-border/60 bg-background text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]'
                    : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
                )}
              >
                <item.icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
                {item.label}
              </a>
            );
          })}
        </nav>

        <div className="mx-2 my-3 border-t border-border/60" />

        {me && (
          <div className="px-2.5">
            <p className="label-mono text-muted-foreground/60">Usage</p>
            <p className="mt-1.5 font-mono text-[11px] tabular-nums text-muted-foreground">
              {me.callsUsed}/{me.callsLimit} calls this month
            </p>
          </div>
        )}

        {/* breathing zone before the pinned profile pill */}
        <div className="min-h-[90px] flex-1" />

        {me ? (
          <div className="flex h-[52px] items-center gap-2.5 rounded-xl border border-border/60 bg-background px-2.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-[11px] uppercase text-muted-foreground">
              {(me.displayName ?? me.email)[0]}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium leading-tight">{me.displayName ?? 'You'}</p>
              <p className="truncate font-mono text-[10px] text-muted-foreground/70">{me.email}</p>
            </div>
            <button
              type="button"
              aria-label="Sign out"
              onClick={async () => {
                await api.logout();
                window.location.reload();
              }}
              className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
            >
              <LogOut className="size-3.5" aria-hidden />
            </button>
          </div>
        ) : (
          <div className="h-[52px]" />
        )}
      </aside>

      {/* elevated content sheet */}
      <div className="m-3 flex min-w-0 flex-1 flex-col overflow-y-auto rounded-2xl border border-border bg-background shadow-card lg:ml-0">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-border/60 bg-background px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <a href="/" className="flex items-center gap-2 font-semibold tracking-tight lg:hidden">
              <BabeMark className="size-6" />
            </a>
            <h1 className="text-[15px] font-medium tracking-tight">{title ?? ''}</h1>
          </div>
          <nav className="flex items-center gap-1 lg:hidden">
            {me &&
              NAV.map((item) => {
                const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'rounded-lg px-2 py-1.5 text-[13px] transition-colors duration-150',
                      active ? 'bg-muted text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {item.label}
                  </a>
                );
              })}
          </nav>
        </header>
        <main className="flex flex-1 flex-col px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
