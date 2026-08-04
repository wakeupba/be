'use client';

import type { Icon } from '@phosphor-icons/react';
import {
  CaretUpDown,
  ClockCounterClockwise,
  CreditCard,
  House,
  List,
  MapTrifold,
  PhoneCall,
  SignOut,
  X,
} from '@phosphor-icons/react';
import { creditsUsable, type MeDto } from '@wakeupbabe/shared';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
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

/* shared so the trigger's aria-controls always names the panel it opens */
const NAV_DRAWER_ID = 'mobile-nav-drawer';

/* the drawer's geometry, in px, as the single source for both its box and the
 * offscreen start of its slide, so the two can't drift apart the way a
 * hand-computed x does */
const DRAWER_WIDTH = 272;
const DRAWER_INSET = 12;
const DRAWER_OFFSCREEN_X = -(DRAWER_WIDTH + DRAWER_INSET);

const NAV: NavItem[] = [...NAV_GROUPS.flat(), ...UTILITY_NAV];

function isActive(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname.replace(/\/+$/, '/') === href || pathname.startsWith(href);
}

/* pillId scopes the sliding active pill to one rail: the desktop aside stays
 * mounted under `hidden lg:flex` while the drawer is open, and two live
 * elements sharing a layoutId make the pill fly between them. */
function SidebarLink({
  item,
  pathname,
  enabled,
  pillId,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  enabled: boolean;
  pillId: string;
  onNavigate?: () => void;
}) {
  const active = isActive(item.href, pathname);
  return (
    <Link
      href={enabled ? item.href : '/'}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors duration-150',
        active ? 'text-foreground' : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
      )}
    >
      {active && (
        <motion.span
          layoutId={pillId}
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
function ProfilePill({ me, onNavigate }: { me: MeDto; onNavigate?: () => void }) {
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
              onClick={() => {
                setOpen(false);
                onNavigate?.();
              }}
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
 * The rail's body, shared by the desktop aside and the mobile drawer so the
 * two can never drift apart. `compact` trims the breathing zone, which the
 * drawer cannot afford on short viewports.
 */
function RailBody({
  me,
  pathname,
  pillId,
  compact,
  onNavigate,
}: {
  me: MeDto | null;
  pathname: string;
  pillId: string;
  compact?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <>
      <nav className="flex flex-col">
        {NAV_GROUPS.map((group, index) => (
          <div key={group[0]?.href} className="flex flex-col gap-0.5">
            {index > 0 && <div className="mx-2 my-2.5 border-t border-border/60" />}
            {group.map((item) => (
              <SidebarLink
                key={item.href}
                item={item}
                pathname={pathname}
                enabled={me !== null}
                pillId={pillId}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ))}
      </nav>

      {/* breathing zone: the rail stays unfilled by design */}
      <div className={cn('flex-1', compact ? 'min-h-6' : 'min-h-[90px]')} />

      {/* pinned footer: meta nav, the usage card, and the identity pill,
          separated from the scroll zone by a full-bleed hairline */}
      <div className="-mx-4 border-t border-border/60 px-4 py-4">
        <div className="mb-3 space-y-0.5">
          {UTILITY_NAV.map((item) => (
            <SidebarLink
              key={item.href}
              item={item}
              pathname={pathname}
              enabled={me !== null}
              pillId={pillId}
              onNavigate={onNavigate}
            />
          ))}
        </div>
        {me && <UsageMeter me={me} />}
        {me ? <ProfilePill me={me} onNavigate={onNavigate} /> : <div aria-hidden className="h-[52px]" />}
      </div>
    </>
  );
}

/*
 * Small screens get the same rail as a floating sheet over a scrim, summoned
 * by the topbar hamburger: the nav is too tall to live in a 56px header, and
 * icon-only tabs dropped both the labels and the usage/identity footer.
 */
function NavDrawer({
  me,
  pathname,
  open,
  onClose,
}: {
  me: MeDto | null;
  pathname: string;
  open: boolean;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      /* innermost layer first: the account menu lives inside the panel and
       * runs its own Escape listener, so let it take the key alone */
      if (panelRef.current?.querySelector('[role="menu"]')) return;
      onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="lg:hidden">
          {/* tap-out target only: Escape and the panel's own close button carry
              the keyboard and screen-reader paths, so it stays out of the tree */}
          <motion.button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 cursor-default bg-foreground/20"
          />
          <motion.div
            ref={panelRef}
            id={NAV_DRAWER_ID}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            tabIndex={-1}
            initial={reduceMotion ? { opacity: 0 } : { x: DRAWER_OFFSCREEN_X }}
            animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { x: DRAWER_OFFSCREEN_X }}
            transition={{ duration: reduceMotion ? 0.15 : 0.28, ease: [0.16, 1, 0.3, 1] }}
            style={{ width: DRAWER_WIDTH, left: DRAWER_INSET }}
            className="fixed inset-y-3 z-50 flex flex-col overflow-y-auto rounded-2xl border border-border bg-background px-4 shadow-card focus-visible:outline-none"
          >
            {/* taller than the topbar it replaces: the wordmark needs air
                before the first nav pill, closer to the desktop rail's h-18 */}
            <div className="flex h-16 shrink-0 items-center justify-between">
              <Link
                href="/"
                onClick={onClose}
                className="flex items-center gap-2 text-[15px] font-semibold tracking-tight"
              >
                {/* the wordmark beside it already names the link */}
                <BabeMark className="size-6" aria-hidden />
                Wake Up Babe
              </Link>
              <button
                type="button"
                aria-label="Close navigation"
                onClick={onClose}
                className="-mr-1.5 flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-muted/60 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <X size={15} aria-hidden />
              </button>
            </div>
            <RailBody me={me} pathname={pathname} pillId="nav-pill-drawer" compact onNavigate={onClose} />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
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
  const [navOpen, setNavOpen] = useState(false);
  const closeNav = useCallback(() => setNavOpen(false), []);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  /* any route change closes the drawer, including a back-button one no link
   * handler sees; reset during render so it never paints over the new page */
  const [navPath, setNavPath] = useState(pathname);
  if (navPath !== pathname) {
    setNavPath(pathname);
    setNavOpen(false);
  }

  /* hand focus back to the trigger, never to document.body. Runs after the
   * render that drops `inert`, so the button is focusable again by then */
  useEffect(() => {
    if (navOpen) {
      wasOpen.current = true;
      return;
    }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    triggerRef.current?.focus();
  }, [navOpen]);

  return (
    <div className="flex h-dvh overflow-hidden bg-canvas">
      {/* sidebar: canvas-level chrome, hidden on small screens */}
      <aside className="hidden w-60 shrink-0 flex-col px-4 lg:flex">
        {/* the logo gets a tall, quiet block of its own */}
        <Link
          href="/"
          className="flex h-18 shrink-0 items-center gap-2 text-[15px] font-semibold tracking-tight"
        >
          {/* the wordmark beside it already names the link */}
          <BabeMark className="size-6" aria-hidden />
          Wake Up Babe
        </Link>

        <RailBody me={me} pathname={pathname} pillId="nav-pill" />
      </aside>

      <NavDrawer me={me} pathname={pathname} open={navOpen} onClose={closeNav} />

      {/* elevated content sheet. `inert` while the drawer is open makes its
          aria-modal honest: without it Tab walks out of the panel into the page
          behind the scrim, which matters because lg:hidden is a width query and
          a narrow desktop window has a real keyboard */}
      <div
        inert={navOpen}
        className="m-3 flex min-w-0 flex-1 flex-col overflow-y-auto rounded-2xl border border-border bg-background shadow-card lg:ml-0"
      >
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-border/60 bg-background px-4 sm:px-6">
          {/* the drawer carries the brand on small screens, so the trigger
              takes the mark's slot instead of crowding beside it */}
          <button
            ref={triggerRef}
            type="button"
            aria-label={navOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={navOpen}
            aria-controls={NAV_DRAWER_ID}
            onClick={() => setNavOpen((v) => !v)}
            className="-ml-1 flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-card text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] transition-colors duration-150 hover:bg-muted/60 hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none active:translate-y-px lg:hidden"
          >
            <List size={16} aria-hidden />
          </button>
          <h1 className="text-[15px] font-medium tracking-tight">{title}</h1>
        </header>
        <main className="flex flex-1 flex-col px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
