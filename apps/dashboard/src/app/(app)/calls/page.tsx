'use client';

import { ArrowUpRight, X } from '@phosphor-icons/react';
import type { CallHistoryDto } from '@wakeupbabe/shared';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Panel, SectionHeader } from '@/components/ui/panel';
import { api } from '@/lib/api';
import {
  type CallChain,
  durationShort,
  groupCalls,
  OUTCOME_WORDS,
  timeOnly,
  timeShort,
} from '@/lib/call-meta';
import { gcalColor } from '@/lib/gcal-colors';
import { useMe } from '@/lib/use-me';
import { cn } from '@/lib/utils';

/* what the keypad press was, when the outcome encodes one */
const PRESSED: Partial<Record<CallHistoryDto['outcome'], string>> = {
  answered_ack: '1',
  answered_snooze: '2',
  answered_no_input: 'nothing',
};

function timingVsStart(placedAt: number, startsAt: number): string {
  const minutes = Math.round((startsAt - placedAt) / 60_000);
  if (minutes === 0) return 'right at start';
  return minutes > 0 ? `${minutes} min before start` : `${-minutes} min after start`;
}

function OutcomeWord({ outcome, className }: { outcome: CallHistoryDto['outcome']; className?: string }) {
  const meta = OUTCOME_WORDS[outcome];
  return (
    <p className={cn('flex shrink-0 items-center gap-1 font-mono text-[11px]', meta.tone, className)}>
      <meta.icon size={12} aria-hidden />
      {meta.word}
    </p>
  );
}

const riseIn = (delay: number) => ({
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] as const, delay },
});

function callName(attempt: CallHistoryDto): string {
  return attempt.attempt === 1 ? 'First call' : `Follow-up ${attempt.attempt - 1}`;
}

/*
 * Quick sheet, spoo link-sheet school: edge-attached, hairline left border,
 * a muted identity header with an at-a-glance stat strip. The body shows ONE
 * call; siblings in the chain are navigation rows, not inlined details.
 */
function CallDetailsSheet({
  chain,
  callId,
  onSelectCall,
  onClose,
}: {
  chain: CallChain | null;
  callId: string | null;
  onSelectCall: (id: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!chain) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [chain, onClose]);

  const attempts = chain ? [chain.root, ...chain.followups] : [];
  const current = attempts.find((a) => a.id === callId) ?? chain?.root ?? null;
  const placed = attempts.filter((a) => a.placedAt !== null).length;
  const resolution = attempts.at(-1);
  const talkMs = attempts.reduce(
    (total, a) => total + (a.answeredAt && a.endedAt ? a.endedAt - a.answeredAt : 0),
    0,
  );
  const answered = current !== null && current.placedAt !== null && current.answeredAt !== null;

  return (
    <AnimatePresence>
      {chain && resolution && current && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-black/10 backdrop-blur-xs"
            onClick={onClose}
            aria-hidden
          />
          <motion.aside
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label="Call details"
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col overflow-y-auto border-l border-border/60 bg-popover shadow-lg"
          >
            {/* identity zone: the meeting, when, and the numbers that matter */}
            <motion.div {...riseIn(0.05)} className="border-b border-border/60 bg-muted px-5 pt-5 pb-4">
              <p className="truncate pr-8 text-[15px] font-medium tracking-tight">{chain.root.eventTitle}</p>
              <p className="mt-1 truncate font-mono text-[11px] tabular-nums text-muted-foreground">
                {chain.root.isTest
                  ? 'do not disturb test call'
                  : chain.root.eventStartsAt !== null
                    ? `starts ${timeShort(chain.root.eventStartsAt)}${
                        chain.root.attendeeCount !== null && chain.root.attendeeCount > 1
                          ? ` · ${chain.root.attendeeCount} people`
                          : ''
                      }${gcalColor(chain.root.colorId) ? ` · flagged ${gcalColor(chain.root.colorId)?.name.toLowerCase()}` : ''}`
                    : 'meeting details unavailable'}
              </p>

              <div className="mt-4 grid grid-cols-3 divide-x divide-border/60 rounded-xl border border-border/60 bg-card">
                <div className="px-3 py-2.5">
                  <p className="label-mono text-[10px] text-muted-foreground/70">Calls</p>
                  <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums">{placed}</p>
                </div>
                <div className="px-3 py-2.5">
                  <p className="label-mono text-[10px] text-muted-foreground/70">Outcome</p>
                  <OutcomeWord outcome={resolution.outcome} className="mt-0.5 leading-7" />
                </div>
                <div className="px-3 py-2.5">
                  <p className="label-mono text-[10px] text-muted-foreground/70">Talk time</p>
                  <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums">
                    {durationShort(0, talkMs)}
                  </p>
                </div>
              </div>

              {chain.root.calendarLink && (
                <a
                  href={chain.root.calendarLink}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-4 transition-colors duration-150 hover:text-foreground"
                >
                  Open in Google Calendar
                  <ArrowUpRight size={12} aria-hidden />
                </a>
              )}

              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="absolute top-3 right-3 flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-background hover:text-foreground"
              >
                <X size={14} aria-hidden />
              </button>
            </motion.div>

            {/* this call only: header on the panel floor, a hero "when"
                line, and an answer-facts strip */}
            <motion.div {...riseIn(0.12)} className="flex flex-col gap-7 px-5 py-6">
              <AnimatePresence mode="wait" initial={false}>
                <motion.section
                  key={current.id}
                  initial={{ opacity: 0, y: 2 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -2 }}
                  transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                >
                  <div className="flex h-9 items-center justify-between">
                    <p className="label-mono text-muted-foreground">{callName(current)}</p>
                    <OutcomeWord outcome={current.outcome} />
                  </div>
                  <div className="rounded-xl border border-border/60 bg-card">
                    <div className="px-4 py-3.5">
                      <p className="label-mono text-[10px] text-muted-foreground/70">Placed</p>
                      <p className="mt-1 font-mono text-[15px] tabular-nums">
                        {current.placedAt ? timeOnly(current.placedAt) : 'not placed'}
                        {current.placedAt && current.eventStartsAt !== null && (
                          <span className="text-[12px] text-muted-foreground">
                            {' '}
                            · {timingVsStart(current.placedAt, current.eventStartsAt)}
                          </span>
                        )}
                      </p>
                    </div>
                    {answered && (
                      <div className="grid grid-cols-3 divide-x divide-border/60 border-t border-border/60">
                        <div className="px-4 py-2.5">
                          <p className="label-mono text-[10px] text-muted-foreground/70">Picked up</p>
                          <p className="mt-1 font-mono text-[15px] font-semibold tabular-nums">
                            {`${Math.max(1, Math.round(((current.answeredAt ?? 0) - (current.placedAt ?? 0)) / 1000))}s`}
                          </p>
                        </div>
                        <div className="px-4 py-2.5">
                          <p className="label-mono text-[10px] text-muted-foreground/70">Duration</p>
                          <p className="mt-1 font-mono text-[15px] font-semibold tabular-nums">
                            {current.answeredAt && current.endedAt
                              ? durationShort(current.answeredAt, current.endedAt)
                              : '0:00'}
                          </p>
                        </div>
                        <div className="px-4 py-2.5">
                          <p className="label-mono text-[10px] text-muted-foreground/70">Pressed</p>
                          <p className="mt-1 font-mono text-[15px] font-semibold tabular-nums">
                            {PRESSED[current.outcome] ?? '–'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  {current.providerCallId && (
                    <p className="mt-2 truncate font-mono text-[10px] text-muted-foreground/50">
                      ref {current.providerCallId}
                    </p>
                  )}
                </motion.section>
              </AnimatePresence>

              {/* the rest of the chain: navigation rows, not inlined details */}
              {attempts.length > 1 && (
                <section>
                  <div className="flex h-9 items-center">
                    <p className="label-mono text-muted-foreground">All calls for this meeting</p>
                  </div>
                  <div className="divide-y divide-border/60 rounded-xl border border-border/60 bg-card">
                    {attempts.map((attempt) => {
                      const isCurrent = attempt.id === current.id;
                      const row = (
                        <>
                          <div className="min-w-0">
                            <p className="text-[13px]">{callName(attempt)}</p>
                            <p className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground/70">
                              {attempt.placedAt ? timeOnly(attempt.placedAt) : 'not placed'}
                            </p>
                          </div>
                          <OutcomeWord outcome={attempt.outcome} />
                        </>
                      );
                      return isCurrent ? (
                        <div
                          key={attempt.id}
                          aria-current="true"
                          className="flex items-center justify-between gap-4 bg-muted/50 px-3.5 py-2.5"
                        >
                          {row}
                        </div>
                      ) : (
                        <button
                          key={attempt.id}
                          type="button"
                          onClick={() => onSelectCall(attempt.id)}
                          className="flex w-full items-center justify-between gap-4 px-3.5 py-2.5 text-left transition-colors duration-150 hover:bg-muted/50"
                        >
                          {row}
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}
            </motion.div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

export default function CallsPage() {
  const { state } = useMe();
  const [calls, setCalls] = useState<CallHistoryDto[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (state.status !== 'ready') return;
    api
      .calls()
      .then(setCalls)
      .catch(() => setCalls([]));
  }, [state.status]);

  if (state.status !== 'ready') return null;

  const chains = calls === null ? null : groupCalls(calls);
  const selected =
    chains?.find((chain) => [chain.root, ...chain.followups].some((a) => a.id === selectedId)) ?? null;

  return (
    <div className="rise-in mx-auto w-full max-w-3xl py-2">
      <SectionHeader
        title="Every call"
        action={
          calls !== null && calls.length > 0 ? (
            <p className="font-mono text-[11px] tabular-nums text-muted-foreground/70">
              {calls.length} {calls.length === 1 ? 'call' : 'calls'}
            </p>
          ) : undefined
        }
      />
      <Panel>
        {chains === null ? (
          <div className="flex min-h-24 items-center justify-center" />
        ) : chains.length === 0 ? (
          <div className="flex min-h-24 items-center justify-center">
            <p className="text-xs text-muted-foreground/70">No calls yet. Your first ring lands here.</p>
          </div>
        ) : (
          <ul>
            {chains.map((chain) => (
              <li key={chain.key} className="border-b border-border/60 last:border-b-0">
                <button
                  type="button"
                  onClick={() => setSelectedId(chain.root.id)}
                  className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors duration-150 hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium">{chain.root.eventTitle}</p>
                    <p className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground/70">
                      {chain.root.placedAt ? timeShort(chain.root.placedAt) : 'not placed'}
                      {chain.root.isTest && ' · test'}
                    </p>
                  </div>
                  <OutcomeWord outcome={chain.root.outcome} />
                </button>
                {chain.followups.map((followup, index) => (
                  <button
                    key={followup.id}
                    type="button"
                    onClick={() => setSelectedId(followup.id)}
                    className="relative flex w-full items-center justify-between gap-4 py-2.5 pr-4 pl-[46px] text-left transition-colors duration-150 hover:bg-muted/50"
                  >
                    {/* branch rail: elbow into this row, line through to the next */}
                    <span
                      aria-hidden
                      className="absolute top-0 left-[22px] h-[19px] w-3 rounded-bl-md border-b border-l border-border"
                    />
                    {index < chain.followups.length - 1 && (
                      <span aria-hidden className="absolute top-0 bottom-0 left-[22px] w-px bg-border" />
                    )}
                    <div className="min-w-0">
                      <p className="text-[13px] text-muted-foreground">Follow-up</p>
                      <p className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground/70">
                        {followup.placedAt ? timeShort(followup.placedAt) : 'not placed'}
                        {` · attempt ${followup.attempt}`}
                      </p>
                    </div>
                    <OutcomeWord outcome={followup.outcome} />
                  </button>
                ))}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <CallDetailsSheet
        chain={selected}
        callId={selectedId}
        onSelectCall={setSelectedId}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
