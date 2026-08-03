'use client';

import type { Icon } from '@phosphor-icons/react';
import {
  CaretUpDown,
  ClockCounterClockwise,
  CreditCard,
  House,
  MapTrifold,
  PhoneCall,
  SignOut,
} from '@phosphor-icons/react';
import { creditsUsable, type MeDto } from '@wakeupbabe/shared';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { BabeMark } from '@/components/brand/mark';
import { buttonVariants } from '@/components/ui/button';
import { api } from '@/lib/api';
import { clearMe } from '@/lib/use-me';
import { cn } from '@/lib/utils';

type NavItem = { href: string; label: string; icon: Icon };

/* the product, then its configuration; roadmap is meta and lives in the
 * utility cluster at the bottom, spoo-sidebar style */
const NAV_GROUPS: NavItem[][] = [
  [
    { href: '/', label: 'Overview', icon: House },
    { href: '/calls/', label: 'Calls', icon: ClockCounterClockwise },
  ],
  [
    { href: '/call-setup/', label: 'Call setup', icon: PhoneCall },
    { href: '/billing/', label: 'Billing', icon: CreditCard },
  ],
];

const UTILITY_NAV: NavItem[] = [{ href: '/roadmap/', label: 'Roadmap', icon: MapTrifold }];

const NAV: NavItem[] = [...NAV_GROUPS.flat(), ...UTILITY_NAV];

function isActive(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname.replace(/\/+$/, '/') === href || pathname.startsWith(href);
}

function SidebarLink({ item, pathname, enabled }: { item: NavItem; pathname: string; enabled: boolean }) {
  const active = isActive(item.href, pathname);
  return (
    <Link
      href={enabled ? item.href : '/'}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors duration-150',
        active ? 'text-foreground' : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
      )}
    >
      {active && (
        <motion.span
          layoutId="nav-pill"
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0 rounded-lg border border-border/50 bg-card shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]"
          aria-hidden
        />
      )}
      <item.icon size={15} weight={active ? 'fill' : 'regular'} className="relative shrink-0" aria-hidden />
      <span className="relative">{item.label}</span>
    </Link>
  );
}

/** identity pill anchoring the rail, spoo anatomy: avatar + name/email +
 * stepper chevron opening the account menu upward */
function ProfilePill({ me }: { me: MeDto }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const name = me.displayName?.trim() || me.email.split('@')[0];

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-[52px] w-full items-center gap-2.5 rounded-lg border border-border bg-card px-2.5 transition-colors duration-150 hover:bg-muted/40"
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand/10 font-mono text-[11px] uppercase text-brand">
          {(me.displayName ?? me.email)[0]}
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block truncate text-[13px] font-medium text-foreground">{name}</span>
          <span className="block truncate text-[11px] text-muted-foreground">{me.email}</span>
        </span>
        <CaretUpDown size={14} className="shrink-0 text-muted-foreground/60" aria-hidden />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 2 }}
            transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
            role="menu"
            className="absolute bottom-full left-0 z-40 mb-1.5 w-full rounded-lg bg-popover p-1 shadow-[0_1px_2px_rgb(0_0_0/0.05),0_8px_20px_-6px_rgb(0_0_0/0.12)] ring-1 ring-foreground/10"
          >
            <div className="px-1.5 py-1">
              <p className="truncate text-xs font-medium text-foreground">{name}</p>
              <p className="truncate text-[11px] text-muted-foreground">{me.email}</p>
            </div>
            <div className="my-1 border-t border-border/60" />
            <Link
              href="/call-setup/"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors duration-150 hover:bg-muted/50 hover:text-foreground"
            >
              <PhoneCall size={13} aria-hidden />
              Call setup
            </Link>
            <div className="my-1 border-t border-border/60" />
            <button
              type="button"
              role="menuitem"
              onClick={async () => {
                await api.logout();
                clearMe();
                window.location.replace('/login/');
              }}
              className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-xs text-destructive transition-colors duration-150 hover:bg-destructive/10"
            >
              <SignOut size={13} aria-hidden />
              Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function titleFor(pathname: string, me: MeDto | null): string {
  if (pathname === '/') {
    return me && (me.phone === null || !me.dndVerified) ? 'Setup' : 'Overview';
  }
  return NAV.find((item) => isActive(item.href, pathname))?.label ?? '';
}

/*
 * Usage lives at the bottom of the sidebar, pinned above the profile pill.
 * The bar counts plan calls only; prepaid credits ride along in the copy.
 * States, quietest first: plenty -> running low -> out (destructive). Free
 * accounts carry the upgrade path; it only gets loud once calls run out.
 */
function UsageMeter({ me }: { me: MeDto }) {
  // one pool of runway: plan allowance plus prepaid credits, matching the
  // billing page; the notch marks where the allowance ends. Credits are
  // frozen on the free plan, so they never count toward free runway.
  const usableCredits = creditsUsable(me.plan) ? me.extraCredits : 0;
  const totalRunway = me.callsLimit + usableCredits;
  const used = Math.min(me.callsUsed, totalRunway);
  const remaining = Math.max(0, totalRunway - me.callsUsed);
  const out = remaining === 0;
  const low = !out && remaining <= Math.max(1, Math.round(totalRunway * 0.2));

  return (
    <div className="mb-3 rounded-lg border border-border/60 bg-card p-3">
      <div className="flex items-baseline justify-between">
        <p className="label-mono text-muted-foreground/60">Usage</p>
        <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {me.callsUsed}/{totalRunway}
        </p>
      </div>
      <div className="relative mt-2 h-1 overflow-hidden rounded-full bg-foreground/10">
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]',
            out ? 'bg-destructive' : 'bg-foreground/70',
          )}
          style={{ width: `${Math.min(100, (used / totalRunway) * 100)}%` }}
        />
        {usableCredits > 0 && (
          <span
            aria-hidden
            className="absolute inset-y-0 w-px bg-background"
            style={{ left: `${(me.callsLimit / totalRunway) * 100}%` }}
          />
        )}
      </div>
      <p
        className={cn(
          'mt-2 font-mono text-[10px] tabular-nums',
          out ? 'text-destructive' : 'text-muted-foreground/70',
        )}
      >
        {out
          ? 'out of calls this month'
          : `${remaining} ${remaining === 1 ? 'call' : 'calls'} left${low ? ', running low' : ''}${usableCredits > 0 ? `, ${usableCredits} prepaid` : ''}`}
      </p>
      {me.plan === 'situationship' && (
        <Link
          href="/billing/"
          className={cn(
            buttonVariants({ variant: out ? 'primary' : 'outline', size: 'sm' }),
            'mt-2.5 w-full',
          )}
        >
          Upgrade, 50 calls a month
        </Link>
      )}
    </div>
  );
}

/*
 * Real-dashboard architecture: a sidebar living on the canvas floor beside an
 * elevated content sheet with its own sticky topbar and scroll. Rendered once
 * from the (app) layout so it survives route changes; the active-nav pill
 * slides between items instead of teleporting.
 */
export function AppShell({ me, children }: { me: MeDto | null; children: ReactNode }) {
  const pathname = usePathname();
  const title = titleFor(pathname, me);

  return (
    <div className="flex h-dvh overflow-hidden bg-canvas">
      {/* sidebar: canvas-level chrome, hidden on small screens */}
      <aside className="hidden w-60 shrink-0 flex-col px-4 lg:flex">
        {/* the logo gets a tall, quiet block of its own */}
        <Link
          href="/"
          className="flex h-18 shrink-0 items-center gap-2 text-[15px] font-semibold tracking-tight"
        >
          <BabeMark className="size-6" />
          Wake Up Babe
        </Link>

        <nav className="flex flex-col">
          {NAV_GROUPS.map((group, index) => (
            <div key={group[0]?.href} className="flex flex-col gap-0.5">
              {index > 0 && <div className="mx-2 my-2.5 border-t border-border/60" />}
              {group.map((item) => (
                <SidebarLink key={item.href} item={item} pathname={pathname} enabled={me !== null} />
              ))}
            </div>
          ))}
        </nav>

        {/* breathing zone: the rail stays unfilled by design */}
        <div className="min-h-[90px] flex-1" />

        {/* pinned footer: meta nav, the usage card, and the identity pill,
            separated from the scroll zone by a full-bleed hairline */}
        <div className="-mx-4 border-t border-border/60 px-4 py-4">
          <div className="mb-3 space-y-0.5">
            {UTILITY_NAV.map((item) => (
              <SidebarLink key={item.href} item={item} pathname={pathname} enabled={me !== null} />
            ))}
          </div>
          {me && <UsageMeter me={me} />}
          {me ? <ProfilePill me={me} /> : <div aria-hidden className="h-[52px]" />}
        </div>
      </aside>

      {/* elevated content sheet */}
      <div className="m-3 flex min-w-0 flex-1 flex-col overflow-y-auto rounded-2xl border border-border bg-background shadow-card lg:ml-0">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-border/60 bg-background px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight lg:hidden">
              <BabeMark className="size-6" />
            </Link>
            <h1 className="text-[15px] font-medium tracking-tight">{title}</h1>
          </div>
          {/* small screens get icon-only tabs; the sidebar covers large */}
          <nav className="flex items-center gap-0.5 lg:hidden">
            {me &&
              NAV.map((item) => {
                const active = isActive(item.href, pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-label={item.label}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex size-8 items-center justify-center rounded-lg transition-colors duration-150',
                      active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <item.icon size={17} weight={active ? 'fill' : 'regular'} aria-hidden />
                  </Link>
                );
              })}
          </nav>
        </header>
        <main className="flex flex-1 flex-col px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
