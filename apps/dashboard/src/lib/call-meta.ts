import type { Icon } from '@phosphor-icons/react';
import {
  Check,
  Clock,
  ClockCountdown,
  Phone,
  PhoneCall,
  PhoneX,
  Prohibit,
  WarningCircle,
} from '@phosphor-icons/react';
import type { CallHistoryDto, UpcomingEventDto } from '@wakeupbabe/shared';

/* one vocabulary for call/event state: a muted mono word, its tone, and a
 * small glyph. Never a pill. */
export const OUTCOME_WORDS: Record<CallHistoryDto['outcome'], { word: string; tone: string; icon: Icon }> = {
  pending: { word: 'ringing', tone: 'text-muted-foreground', icon: PhoneCall },
  answered_ack: { word: 'acknowledged', tone: 'text-live', icon: Check },
  answered_snooze: { word: 'snoozed', tone: 'text-muted-foreground', icon: ClockCountdown },
  answered_no_input: { word: 'heard', tone: 'text-muted-foreground', icon: Phone },
  no_answer: { word: 'missed', tone: 'text-destructive', icon: PhoneX },
  failed: { word: 'failed', tone: 'text-destructive', icon: WarningCircle },
};

export const EVENT_WORDS: Record<UpcomingEventDto['state'], { word: string; tone: string; icon: Icon }> = {
  scheduled: { word: 'scheduled', tone: 'text-muted-foreground', icon: Clock },
  snoozed: { word: 'snoozed', tone: 'text-muted-foreground', icon: ClockCountdown },
  calling: { word: 'ringing now', tone: 'text-live', icon: PhoneCall },
  acknowledged: { word: 'acknowledged', tone: 'text-live', icon: Check },
  missed: { word: 'missed', tone: 'text-destructive', icon: PhoneX },
  cancelled: { word: 'cancelled', tone: 'text-muted-foreground/60', icon: Prohibit },
};

export function timeShort(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function timeOnly(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function durationShort(fromMs: number, toMs: number): string {
  const seconds = Math.max(0, Math.round((toMs - fromMs) / 1000));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/*
 * A chain is one meeting's calls: attempt 1 is the root, retries and snooze
 * follow-ups branch under it. Verification calls have no event and stand
 * alone. Chains order by their latest activity, newest first.
 */
export interface CallChain {
  key: string;
  root: CallHistoryDto;
  followups: CallHistoryDto[];
  latestAt: number;
}

export function groupCalls(rows: CallHistoryDto[]): CallChain[] {
  const byKey = new Map<string, CallHistoryDto[]>();
  for (const row of rows) {
    const key = row.eventId ?? row.id;
    const list = byKey.get(key);
    if (list) list.push(row);
    else byKey.set(key, [row]);
  }
  return [...byKey.entries()]
    .map(([key, list]) => {
      const sorted = [...list].sort((a, b) => a.attempt - b.attempt || a.createdAt - b.createdAt);
      const [root, ...followups] = sorted;
      const latestAt = Math.max(...list.map((c) => c.placedAt ?? c.createdAt));
      return { key, root, followups, latestAt };
    })
    .sort((a, b) => b.latestAt - a.latestAt);
}
