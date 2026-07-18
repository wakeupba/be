'use client';

import { LEAD_MINUTE_OPTIONS, type LeadMinutes } from '@wakeupbabe/shared';
import { Check } from 'lucide-react';
import { useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Panel, SectionHeader } from '@/components/ui/panel';
import { api } from '@/lib/api';
import { useMe } from '@/lib/use-me';
import { cn } from '@/lib/utils';

/* google calendar's own event palette; the trigger color is real product
 * data, so the swatches use the real values */
const GCAL_COLORS: Array<{ id: string; name: string; hex: string }> = [
  { id: '1', name: 'Lavender', hex: '#7986cb' },
  { id: '2', name: 'Sage', hex: '#33b679' },
  { id: '3', name: 'Grape', hex: '#8e24aa' },
  { id: '4', name: 'Flamingo', hex: '#e67c73' },
  { id: '5', name: 'Banana', hex: '#f6bf26' },
  { id: '6', name: 'Tangerine', hex: '#f4511e' },
  { id: '7', name: 'Peacock', hex: '#039be5' },
  { id: '8', name: 'Graphite', hex: '#616161' },
  { id: '9', name: 'Blueberry', hex: '#3f51b5' },
  { id: '10', name: 'Basil', hex: '#0b8043' },
  { id: '11', name: 'Tomato', hex: '#d50000' },
];

export default function SettingsPage() {
  const { state, refresh } = useMe();
  const [busy, setBusy] = useState(false);

  if (state.status !== 'ready') {
    return <AppShell me={null}>{null}</AppShell>;
  }
  const { me } = state;

  async function save(patch: Record<string, unknown>) {
    setBusy(true);
    try {
      await api.updateSettings(patch);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const triggerColor = GCAL_COLORS.find((color) => color.id === me.triggerColorId);

  return (
    <AppShell me={me}>
      <div className="rise-in mx-auto flex w-full max-w-2xl flex-col gap-6 py-2">
        <section>
          <SectionHeader title="Trigger color" />
          <Panel className="p-4">
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Events painted this color in Google Calendar get a call. Currently{' '}
              <span className="text-foreground">{triggerColor?.name ?? 'Tomato'}</span>.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {GCAL_COLORS.map((color) => (
                <button
                  key={color.id}
                  type="button"
                  disabled={busy}
                  title={color.name}
                  onClick={() => void save({ triggerColorId: color.id })}
                  className={cn(
                    'flex size-7 items-center justify-center rounded-full transition-transform duration-150 hover:scale-105 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                    me.triggerColorId === color.id && 'ring-2 ring-foreground ring-offset-2',
                  )}
                  style={{ backgroundColor: color.hex }}
                >
                  {me.triggerColorId === color.id && (
                    <Check className="size-3.5 text-white" strokeWidth={3} aria-hidden />
                  )}
                </button>
              ))}
            </div>
          </Panel>
        </section>

        <section>
          <SectionHeader title="Lead time" />
          <Panel className="p-4">
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              How long before the meeting we ring.
            </p>
            <div className="mt-3 inline-flex h-8 items-center gap-0.5 rounded-lg border border-border/60 bg-muted/40 p-0.5">
              {LEAD_MINUTE_OPTIONS.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  disabled={busy}
                  onClick={() => void save({ leadMinutes: minutes as LeadMinutes })}
                  className={cn(
                    'h-7 rounded-md px-3 font-mono text-[11px] tabular-nums transition-colors duration-150',
                    me.leadMinutes === minutes
                      ? 'border border-border/60 bg-card text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {minutes} min
                </button>
              ))}
            </div>
          </Panel>
        </section>

        <section>
          <SectionHeader title="Phone" />
          <Panel className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[15px] tabular-nums">{me.phone ?? 'not set'}</p>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground/70">
                  {me.dndVerified ? 'verified through do not disturb' : 'not verified yet'}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await api.verifyCall().catch(() => null);
                }}
              >
                Run verification call
              </Button>
            </div>
          </Panel>
        </section>

        <section>
          <SectionHeader title="Billing" />
          <Panel className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[13px] text-muted-foreground">
                {me.plan === 'ride_or_die'
                  ? 'Ride or Die, 50 calls a month.'
                  : 'Situationship, 5 calls a month, free.'}
              </p>
              <Button variant="outline" size="sm" disabled>
                Manage billing
              </Button>
            </div>
            <p className="mt-2 font-mono text-[10px] text-muted-foreground/60">billing opens at launch</p>
          </Panel>
        </section>
      </div>
    </AppShell>
  );
}
