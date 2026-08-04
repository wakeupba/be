'use client';

import {
  ArrowsClockwise,
  ArrowUpRight,
  CalendarBlank,
  ClockCounterClockwise,
  Flag,
  HeartStraight,
  PhoneOutgoing,
} from '@phosphor-icons/react';
import { type CallHistoryDto, type MeDto, PLAN_LIMITS, type UpcomingEventDto } from '@wakeupbabe/shared';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Kpi } from '@/components/ui/kpi';
import { Panel, SectionHeader } from '@/components/ui/panel';
import { api } from '@/lib/api';
import { EVENT_WORDS, OUTCOME_WORDS, timeShort } from '@/lib/call-meta';
import { gcalColor } from '@/lib/gcal-colors';
import { cn } from '@/lib/utils';

const RECENT_CALLS = 5;
/** how long the button reports the outcome, so a refresh never looks ignored */
const OUTCOME_LABEL_MS = 4000;

/*
 * Server-declared end of the per-user cooldown. Module scope, not a ref: the
 * cooldown belongs to the user, not to one mount, and Overview → Calls →
 * Overview would otherwise reset it and spend a /me/sync that can only come
 * back cooling_down. Same reasoning as the session store in use-me.
 */
let nextRefreshAt = 0;

/* 'stale' covers both a sync google refused and a refresh we never got to run
 * (no calendar, rate limited, network): in all of them the list on screen is
 * the old one, and saying "up to date" would be a lie. The label deliberately
 * does not name a cause — only one of the four ever reached Google. */
type Outcome = 'checked' | 'stale';

export function Overview({ me }: { me: MeDto }) {
  const [events, setEvents] = useState<UpcomingEventDto[] | null>(null);
  const [calls, setCalls] = useState<CallHistoryDto[] | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const refresh = useCallback(async () => {
    setSyncing(true);
    try {
      const result = await api.syncEvents();
      setEvents(result.events);
      nextRefreshAt = result.nextRefreshAt;
      // cooling_down is still an honest "up to date": the list is the one from
      // the last check, and that was inside the cooldown. 'failed' is not —
      // it comes back 200 with the events we already had, so only status
      // distinguishes it from a real sync
      setOutcome(result.status === 'failed' ? 'stale' : 'checked');
    } catch {
      // a refresh we were not allowed to run still has to leave the page
      // showing whatever we already know
      await api
        .events()
        .then(setEvents)
        .catch(() => setEvents([]));
      setOutcome('stale');
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    // onboarding only proves a verified phone, so this page also renders for
    // someone who has since disconnected: nothing to ask google about
    if (me.calendarConnected) {
      void refresh();
    } else {
      api
        .events()
        .then(setEvents)
        .catch(() => setEvents([]));
    }
    api
      .calls()
      .then(setCalls)
      .catch(() => setCalls([]));
  }, [refresh, me.calendarConnected]);

  useEffect(() => {
    if (outcome === null) return;
    const timer = setTimeout(() => setOutcome(null), OUTCOME_LABEL_MS);
    return () => clearTimeout(timer);
  }, [outcome]);

  /* coming back to the tab is the other half of the paranoid refresh: you
   * flagged the meeting in Google Calendar and switched back here */
  useEffect(() => {
    const onFocus = () => {
      if (!me.calendarConnected || Date.now() < nextRefreshAt) return;
      void refresh();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh, me.calendarConnected]);

  const nextRing = events?.find((event) => event.state === 'scheduled' || event.state === 'snoozed');
  /* the activation nudge is for people who have never had a real call; test
   * calls from onboarding don't count */
  const hasRealCalls = calls?.some((call) => !call.isTest) ?? false;
  const triggerColor = gcalColor(me.triggerColorId);

  return (
    <div className="rise-in mx-auto flex w-full max-w-4xl flex-col gap-6 py-2">
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi
          label="Calls this month"
          icon={PhoneOutgoing}
          value={calls === null ? '–' : String(me.callsUsed)}
          sub={`of ${me.callsLimit + me.extraCredits}`}
          footer={me.extraCredits > 0 ? `incl. ${me.extraCredits} prepaid credits` : 'resets monthly'}
        />
        <Kpi
          label="Flagged meetings"
          icon={Flag}
          value={events === null ? '–' : String(events.length)}
          footer={nextRing ? `next ring ${timeShort(nextRing.callAt)}` : 'color one red to schedule'}
        />
        <Kpi
          label="Plan"
          icon={HeartStraight}
          value={me.plan === 'ride_or_die' ? 'Ride or Die' : 'Situationship'}
          footer={
            me.plan === 'ride_or_die'
              ? `${PLAN_LIMITS.ride_or_die.callsPerMonth} calls a month`
              : `upgrade for ${PLAN_LIMITS.ride_or_die.callsPerMonth} calls a month`
          }
        />
      </div>

      <section>
        <SectionHeader
          title="Upcoming calls"
          icon={CalendarBlank}
          action={
            me.calendarConnected ? (
              <button
                type="button"
                onClick={() => void refresh()}
                disabled={syncing}
                className={cn(
                  'inline-flex items-center gap-1.5 text-xs transition-colors duration-150 hover:text-foreground disabled:opacity-60',
                  !syncing && outcome === 'stale' ? 'text-destructive' : 'text-muted-foreground',
                )}
              >
                <ArrowsClockwise size={12} className={cn(syncing && 'animate-spin')} aria-hidden />
                {syncing
                  ? 'Checking…'
                  : outcome === 'stale'
                    ? "Couldn't refresh"
                    : outcome === 'checked'
                      ? 'Up to date'
                      : 'Refresh'}
              </button>
            ) : undefined
          }
        />
        <Panel>
          {events === null || (events.length === 0 && calls === null) ? (
            <div className="flex min-h-24 items-center justify-center" />
          ) : events.length === 0 ? (
            hasRealCalls ? (
              <div className="flex min-h-24 items-center justify-center px-4">
                <p className="text-xs text-muted-foreground/70">No flagged meetings right now.</p>
              </div>
            ) : (
              <div className="flex min-h-24 flex-col items-center justify-center gap-2 px-4 py-5 text-center">
                <p className="max-w-sm text-[13px] text-muted-foreground">
                  Color a meeting{' '}
                  {triggerColor && (
                    <span
                      className="inline-block size-2.5 translate-y-px rounded-full shadow-swatch"
                      style={{ backgroundColor: triggerColor.hex }}
                      aria-hidden
                    />
                  )}{' '}
                  {triggerColor ? triggerColor.name : 'your trigger color'} in Google Calendar, then hit
                  refresh. We also check on our own every 5 minutes.
                </p>
                <a
                  href="https://calendar.google.com"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-4 transition-colors duration-150 hover:text-foreground"
                >
                  Open Google Calendar
                  <ArrowUpRight size={12} aria-hidden />
                </a>
              </div>
            )
          ) : (
            <ul>
              {events.map((event) => {
                const state = EVENT_WORDS[event.state];
                return (
                  <li
                    key={event.id}
                    className="flex items-center justify-between gap-4 border-b border-border/60 px-4 py-3 transition-colors duration-150 last:border-b-0 hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium">{event.title}</p>
                      <p className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground/70">
                        starts {timeShort(event.startsAt)}
                        {event.attendeeCount > 1 && ` · ${event.attendeeCount} people`}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p
                        className={cn(
                          'flex items-center justify-end gap-1 font-mono text-[11px]',
                          state.tone,
                        )}
                      >
                        <state.icon size={12} aria-hidden />
                        {state.word}
                      </p>
                      {(event.state === 'scheduled' || event.state === 'snoozed') && (
                        <p className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground/70">
                          rings {timeShort(event.callAt)}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </section>

      <section>
        <SectionHeader
          title="Call history"
          icon={ClockCounterClockwise}
          action={
            calls !== null && calls.length > 0 ? (
              <Link
                href="/calls/"
                className="text-[12px] text-muted-foreground transition-colors duration-150 hover:text-foreground"
              >
                View all
              </Link>
            ) : undefined
          }
        />
        <Panel>
          {calls === null ? (
            <div className="flex min-h-24 items-center justify-center" />
          ) : calls.length === 0 ? (
            <div className="flex min-h-24 items-center justify-center">
              <p className="text-xs text-muted-foreground/70">No calls yet.</p>
            </div>
          ) : (
            <ul>
              {calls.slice(0, RECENT_CALLS).map((call) => {
                const outcome = OUTCOME_WORDS[call.outcome];
                return (
                  <li
                    key={call.id}
                    className="flex items-center justify-between gap-4 border-b border-border/60 px-4 py-3 transition-colors duration-150 last:border-b-0 hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium">{call.eventTitle}</p>
                      <p className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground/70">
                        {call.placedAt ? timeShort(call.placedAt) : 'not placed'}
                        {call.attempt > 1 && ` · attempt ${call.attempt}`}
                        {call.isTest && ' · test'}
                      </p>
                    </div>
                    <p className={cn('flex shrink-0 items-center gap-1 font-mono text-[11px]', outcome.tone)}>
                      <outcome.icon size={12} aria-hidden />
                      {outcome.word}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </section>
    </div>
  );
}
