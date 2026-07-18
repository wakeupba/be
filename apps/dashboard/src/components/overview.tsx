'use client';

import type { CallHistoryDto, MeDto, UpcomingEventDto } from '@wakeupbabe/shared';
import { useEffect, useState } from 'react';
import { Kpi } from '@/components/ui/kpi';
import { Panel, SectionHeader } from '@/components/ui/panel';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

const OUTCOME_WORDS: Record<CallHistoryDto['outcome'], { word: string; tone: string }> = {
  pending: { word: 'ringing', tone: 'text-muted-foreground' },
  answered_ack: { word: 'acknowledged', tone: 'text-live' },
  answered_snooze: { word: 'snoozed', tone: 'text-muted-foreground' },
  answered_no_input: { word: 'heard', tone: 'text-muted-foreground' },
  no_answer: { word: 'missed', tone: 'text-destructive' },
  failed: { word: 'failed', tone: 'text-destructive' },
};

const EVENT_WORDS: Record<UpcomingEventDto['state'], { word: string; tone: string }> = {
  scheduled: { word: 'scheduled', tone: 'text-muted-foreground' },
  snoozed: { word: 'snoozed', tone: 'text-muted-foreground' },
  calling: { word: 'ringing now', tone: 'text-live' },
  acknowledged: { word: 'acknowledged', tone: 'text-live' },
  missed: { word: 'missed', tone: 'text-destructive' },
  cancelled: { word: 'cancelled', tone: 'text-muted-foreground/60' },
};

function timeShort(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function Overview({ me }: { me: MeDto }) {
  const [events, setEvents] = useState<UpcomingEventDto[] | null>(null);
  const [calls, setCalls] = useState<CallHistoryDto[] | null>(null);

  useEffect(() => {
    api
      .events()
      .then(setEvents)
      .catch(() => setEvents([]));
    api
      .calls()
      .then(setCalls)
      .catch(() => setCalls([]));
  }, []);

  const nextRing = events?.find((event) => event.state === 'scheduled' || event.state === 'snoozed');

  return (
    <div className="rise-in mx-auto flex w-full max-w-4xl flex-col gap-6 py-2">
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi
          label="Calls this month"
          value={calls === null ? '–' : String(me.callsUsed)}
          sub={`of ${me.callsLimit}`}
          footer={me.extraCredits > 0 ? `+${me.extraCredits} prepaid credits` : 'resets monthly'}
        />
        <Kpi
          label="Flagged meetings"
          value={events === null ? '–' : String(events.length)}
          footer={nextRing ? `next ring ${timeShort(nextRing.callAt)}` : 'color one red to schedule'}
        />
        <Kpi
          label="Plan"
          value={me.plan === 'ride_or_die' ? 'Ride or Die' : 'Situationship'}
          footer={me.plan === 'ride_or_die' ? 'thank you, babe' : 'upgrade for 50 calls a month'}
        />
      </div>

      <section>
        <SectionHeader title="Upcoming calls" />
        <Panel>
          {events === null ? (
            <div className="flex min-h-24 items-center justify-center" />
          ) : events.length === 0 ? (
            <div className="flex min-h-24 items-center justify-center px-4">
              <p className="text-xs text-muted-foreground/70">
                No flagged meetings. Color one red in Google Calendar and it shows up within 5 minutes.
              </p>
            </div>
          ) : (
            <ul>
              {events.map((event) => (
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
                    <p className={cn('font-mono text-[11px]', EVENT_WORDS[event.state].tone)}>
                      {EVENT_WORDS[event.state].word}
                    </p>
                    {(event.state === 'scheduled' || event.state === 'snoozed') && (
                      <p className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground/70">
                        rings {timeShort(event.callAt)}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>

      <section>
        <SectionHeader title="Call history" />
        <Panel>
          {calls === null ? (
            <div className="flex min-h-24 items-center justify-center" />
          ) : calls.length === 0 ? (
            <div className="flex min-h-24 items-center justify-center">
              <p className="text-xs text-muted-foreground/70">No calls yet.</p>
            </div>
          ) : (
            <ul>
              {calls.map((call) => (
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
                  <p className={cn('shrink-0 font-mono text-[11px]', OUTCOME_WORDS[call.outcome].tone)}>
                    {OUTCOME_WORDS[call.outcome].word}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>
    </div>
  );
}
