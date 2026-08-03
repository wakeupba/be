'use client';

import { ChartBar, CreditCard, PlusCircle } from '@phosphor-icons/react';
import { creditsUsable, TOPUP_PACK } from '@wakeupbabe/shared';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Panel, SectionHeader, Shell } from '@/components/ui/panel';
import { api } from '@/lib/api';
import { refreshMe, useMe } from '@/lib/use-me';
import { cn } from '@/lib/utils';

/*
 * Real plan data, real usage math. Purchase actions are live once the API
 * says billing is configured; until then they stay honestly disabled. All
 * money UI is Dodo's hosted checkout / portal, we only link out.
 */
export default function BillingPage() {
  const { state } = useMe();
  const [busy, setBusy] = useState<'upgrade' | 'topup' | 'portal' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [returned, setReturned] = useState<'settling' | 'failed' | null>(null);

  /* back from Dodo checkout. Dodo returns here for failures too, so read
   * its status param instead of declaring victory; on the happy path the
   * webhook flips the plan within seconds and the refreshes pick it up */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('checkout')) return;
    const status = params.get('status');
    const failed = status !== null && !['succeeded', 'active', 'processing'].includes(status);
    setReturned(failed ? 'failed' : 'settling');
    window.history.replaceState(null, '', window.location.pathname);
    if (failed) return;
    const timers = [2_000, 5_000, 10_000].map((ms) => setTimeout(() => void refreshMe(), ms));
    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
  }, []);

  if (state.status !== 'ready') return null;
  const { me } = state;

  const free = me.plan === 'situationship';
  const live = me.billingEnabled;
  // one pool of runway: plan allowance plus prepaid credits. The bar carries
  // a notch where the allowance ends so the two pools stay distinguishable.
  // On the free plan credits are frozen: kept, shown, but not runway.
  const usableCredits = creditsUsable(me.plan) ? me.extraCredits : 0;
  const frozenCredits = free ? me.extraCredits : 0;
  const totalRunway = me.callsLimit + usableCredits;
  const used = Math.min(me.callsUsed, totalRunway);
  const remaining = Math.max(0, totalRunway - me.callsUsed);
  const out = remaining === 0;

  async function startCheckout(kind: 'upgrade' | 'topup') {
    setBusy(kind);
    setError(null);
    try {
      const { url } = await api.billingCheckout(kind);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'could not start checkout');
      setBusy(null);
    }
  }

  async function openPortal() {
    setBusy('portal');
    setError(null);
    try {
      const { url } = await api.billingPortal();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'could not open the billing portal');
      setBusy(null);
    }
  }

  return (
    <div className="rise-in mx-auto flex w-full max-w-2xl flex-col gap-10 py-4">
      <section>
        <SectionHeader title="Plan" icon={CreditCard} />
        <Shell>
          <div className="flex h-full flex-col">
            <div className="p-5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[15px] font-semibold tracking-tight">
                  {free ? 'Situationship' : 'Ride or Die'}
                </p>
                <p className="font-mono text-[13px] tabular-nums text-muted-foreground">
                  {free ? '$0/mo' : '$5/mo'}
                </p>
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                {free ? '5 calls a month. We call sometimes.' : '50 calls a month. We always call.'}
              </p>
            </div>
            <div className="flex h-12 items-center justify-between rounded-b-[14px] border-t border-border/60 bg-muted/30 px-5">
              <p
                className={cn(
                  'font-mono text-[10px]',
                  returned === 'failed' ? 'text-destructive' : 'text-muted-foreground/60',
                )}
              >
                {returned === 'failed'
                  ? 'checkout did not complete, you were not charged'
                  : returned === 'settling'
                    ? 'checkout finished, this updates once payment settles'
                    : live
                      ? free
                        ? '$5/mo, cancel whenever'
                        : 'handled by dodo payments'
                      : 'billing opens at launch'}
              </p>
              {free ? (
                <Button
                  variant={live ? 'primary' : 'outline'}
                  size="sm"
                  disabled={!live || busy !== null}
                  onClick={() => void startCheckout('upgrade')}
                >
                  {busy === 'upgrade' ? 'Opening checkout' : 'Upgrade to Ride or Die'}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!live || busy !== null}
                  onClick={() => void openPortal()}
                >
                  {busy === 'portal' ? 'Opening portal' : 'Manage billing'}
                </Button>
              )}
            </div>
          </div>
        </Shell>
      </section>

      <section>
        <SectionHeader title="Usage this period" icon={ChartBar} />
        <Panel className="p-5">
          <div className="flex items-baseline justify-between">
            <p className="font-mono text-[13px] tabular-nums">
              {me.callsUsed} of {totalRunway} calls
            </p>
            <p
              className={cn(
                'font-mono text-[11px] tabular-nums',
                out ? 'text-destructive' : 'text-muted-foreground/70',
              )}
            >
              {out ? 'out of calls' : `${remaining} left`}
            </p>
          </div>
          <div className="relative mt-3 h-1 overflow-hidden rounded-full bg-foreground/10">
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
          <div className="mt-4 flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <p className="text-[13px] text-muted-foreground">Plan allowance</p>
              <p className="font-mono text-[13px] tabular-nums">{me.callsLimit}</p>
            </div>
            <div className="flex items-baseline justify-between">
              <p className="text-[13px] text-muted-foreground">Prepaid credits</p>
              <p className="font-mono text-[13px] tabular-nums">
                {me.extraCredits}
                {frozenCredits > 0 && <span className="text-muted-foreground/60"> · frozen</span>}
              </p>
            </div>
          </div>
          <p className="mt-4 font-mono text-[10px] text-muted-foreground/60">
            {frozenCredits > 0
              ? 'prepaid credits carry over and work while ride or die is active'
              : 'plan calls reset monthly, prepaid credits carry over'}
          </p>
        </Panel>
      </section>

      <section>
        <SectionHeader title="Top-ups" icon={PlusCircle} />
        <Panel className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                A prepaid pack of {TOPUP_PACK.calls} extra calls for ${TOPUP_PACK.priceUsd}. No metered
                overage, no surprise invoice.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={!live || free || busy !== null}
              onClick={() => void startCheckout('topup')}
            >
              {busy === 'topup' ? 'Opening checkout' : 'Buy a pack'}
            </Button>
          </div>
          {!live ? (
            <p className="mt-2 font-mono text-[10px] text-muted-foreground/60">opens at launch</p>
          ) : free ? (
            <p className="mt-2 font-mono text-[10px] text-muted-foreground/60">
              packs are extra calls on ride or die, upgrade first
            </p>
          ) : null}
        </Panel>
      </section>

      {error && <p className="font-mono text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
