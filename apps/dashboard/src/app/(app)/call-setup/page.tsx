'use client';

import { ArrowUpRight, CaretDown, CaretUpDown, Check, SealCheck } from '@phosphor-icons/react';
import { LEAD_MINUTE_OPTIONS, type LeadMinutes } from '@wakeupbabe/shared';
import { formatPhoneDraft, parsePhone } from '@wakeupbabe/shared/phone';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { Button, ButtonLink } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shell } from '@/components/ui/panel';
import { ApiError, api } from '@/lib/api';
import { GCAL_COLORS } from '@/lib/gcal-colors';
import { useMe } from '@/lib/use-me';
import { cn } from '@/lib/utils';

const swap = {
  initial: { opacity: 0, y: 2 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -2 },
  transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] as const },
};

function ColorDot({ hex, className }: { hex: string; className?: string }) {
  return (
    <span
      className={cn('size-3.5 shrink-0 rounded-full shadow-swatch', className)}
      style={{ backgroundColor: hex }}
      aria-hidden
    />
  );
}

/*
 * The trigger-color select: the closed state mirrors an input (dot + name),
 * the open menu is flat quiet rows with the check on the right. A menu shows
 * the color names, which a bare swatch row never could.
 */
function TriggerColorSelect({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = GCAL_COLORS.find((color) => color.id === value) ?? GCAL_COLORS[10];

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
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-44 items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 text-[13px] shadow-soft transition-colors duration-150 hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
      >
        <ColorDot hex={current.hex} />
        {current.name}
        <CaretUpDown size={12} className="ml-auto text-muted-foreground" aria-hidden />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
            role="listbox"
            aria-label="Trigger color"
            className="absolute right-0 top-full z-30 mt-1.5 w-44 rounded-lg bg-popover p-1 shadow-pop ring-1 ring-foreground/10"
          >
            {GCAL_COLORS.map((color) => {
              const selected = color.id === value;
              return (
                <li key={color.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      onChange(color.id);
                      setOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-xs transition-colors duration-150',
                      selected
                        ? 'bg-muted/70 text-foreground'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                    )}
                  >
                    <ColorDot hex={color.hex} />
                    {color.name}
                    {selected && <Check size={12} className="ml-auto" aria-hidden />}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

/* one settings-row grammar: title + description in a fixed left column,
 * the control right-aligned; rows share hairlines via divide-y */
function Row({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-4 px-6 py-7 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-10">
      <div>
        <p className="text-[13px] font-medium">{title}</p>
        <p className="mt-1.5 max-w-xs text-[13px] leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">{children}</div>
    </div>
  );
}

/*
 * The connection everything rides on. At rest: the account and one quiet
 * Manage control. The actions live in a flat menu; disconnect confirms as
 * its own explicit moment because it cancels every scheduled call.
 */
function CalendarRow({
  email,
  connected,
  refresh,
}: {
  email: string;
  connected: boolean;
  refresh: () => Promise<unknown>;
}) {
  const [mode, setMode] = useState<'rest' | 'menu' | 'confirm'>('rest');
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mode !== 'menu') return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setMode('rest');
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMode('rest');
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [mode]);

  async function disconnect() {
    setBusy(true);
    try {
      await api.disconnectCalendar();
      await refresh();
    } finally {
      setBusy(false);
      setMode('rest');
    }
  }

  if (!connected) {
    return (
      <Row title="Google Calendar" description="The account we watch for events painted your trigger color.">
        <div className="flex w-full flex-col gap-3 sm:items-end">
          <p className="font-mono text-[11px] text-destructive sm:text-right">
            calendar disconnected, calls are paused
          </p>
          <ButtonLink href={api.loginUrl()} size="sm">
            Connect Google Calendar
          </ButtonLink>
        </div>
      </Row>
    );
  }

  return (
    <Row title="Google Calendar" description="The account we watch for events painted your trigger color.">
      <div className="flex h-8 w-full items-center sm:justify-end">
        <AnimatePresence mode="wait" initial={false}>
          {mode === 'confirm' ? (
            <motion.div key="confirm" {...swap} className="flex items-center gap-2">
              <p className="font-mono text-[11px] text-destructive">cancels every scheduled call</p>
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => setMode('rest')}>
                Keep
              </Button>
              <Button variant="destructive" size="sm" disabled={busy} onClick={() => void disconnect()}>
                {busy ? 'Disconnecting' : 'Disconnect'}
              </Button>
            </motion.div>
          ) : (
            <motion.div key="rest" {...swap} className="flex items-center gap-2">
              <p className="font-mono text-[13px]">{email}</p>
              <div ref={rootRef} className="relative">
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={mode === 'menu'}
                  onClick={() => setMode(mode === 'menu' ? 'rest' : 'menu')}
                  className="flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground transition-colors duration-150 hover:bg-muted/60 hover:text-foreground"
                >
                  Manage
                  <CaretDown size={11} aria-hidden />
                </button>
                <AnimatePresence>
                  {mode === 'menu' && (
                    <motion.div
                      initial={{ opacity: 0, y: -2 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -2 }}
                      transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
                      role="menu"
                      className="absolute right-0 top-full z-30 mt-1.5 w-44 rounded-lg bg-popover p-1 shadow-pop ring-1 ring-foreground/10"
                    >
                      <a
                        href="https://myaccount.google.com/permissions"
                        target="_blank"
                        rel="noreferrer"
                        role="menuitem"
                        className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors duration-150 hover:bg-muted/50 hover:text-foreground"
                      >
                        Manage access
                        <ArrowUpRight size={11} className="ml-auto" aria-hidden />
                      </a>
                      <a
                        href={api.loginUrl()}
                        role="menuitem"
                        className="flex w-full items-center rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors duration-150 hover:bg-muted/50 hover:text-foreground"
                      >
                        Reconnect
                      </a>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => setMode('confirm')}
                        className="flex w-full items-center rounded-md px-1.5 py-1 text-xs text-destructive transition-colors duration-150 hover:bg-destructive/10"
                      >
                        Disconnect
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Row>
  );
}

function PhoneRow({
  phone,
  dndVerified,
  refresh,
}: {
  phone: string | null;
  dndVerified: boolean;
  refresh: () => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // same distinction the onboarding step makes: a country we do not reach yet
  // is a status, not something the user typed wrong
  const [unreachableCountry, setUnreachableCountry] = useState<string | null>(null);
  const [verifyPhase, setVerifyPhase] = useState<'idle' | 'calling'>('idle');
  const verifyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const parsedDraft = parsePhone(draft);
  const draftValid = parsedDraft.valid;

  useEffect(
    () => () => {
      if (verifyTimer.current) clearTimeout(verifyTimer.current);
    },
    [],
  );

  async function savePhone() {
    setSaving(true);
    setError(null);
    setUnreachableCountry(null);
    try {
      await api.updateSettings({ phone: parsedDraft.e164 });
      await refresh();
      setEditing(false);
      setDraft('');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'region_unsupported') {
        // the field stays open: the old number still works, and this one never
        // replaced it
        setUnreachableCountry(parsedDraft.country ?? 'that country');
      } else {
        setError(err instanceof Error ? err.message : 'could not save');
      }
    } finally {
      setSaving(false);
    }
  }

  async function runVerification() {
    setError(null);
    try {
      await api.verifyCall();
      setVerifyPhase('calling');
      void refresh();
      if (verifyTimer.current) clearTimeout(verifyTimer.current);
      verifyTimer.current = setTimeout(() => setVerifyPhase('idle'), 12_000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'call failed');
    }
  }

  return (
    <Row title="Phone" description="The number we call, proven to ring through Do Not Disturb.">
      <AnimatePresence mode="wait" initial={false}>
        {editing ? (
          <motion.div key="edit" {...swap} className="flex w-full flex-col gap-2.5 sm:items-end">
            <form
              className="flex w-full max-w-sm gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void savePhone();
              }}
            >
              <Input
                autoFocus
                type="tel"
                value={draft}
                onChange={(event) => setDraft(formatPhoneDraft(event.target.value))}
                placeholder="+14155550123"
                aria-label="New phone number"
                aria-invalid={draft.length > 3 && !draftValid}
                className="font-mono tabular-nums"
              />
              <Button type="submit" disabled={!draftValid || saving}>
                {saving ? 'Saving' : 'Save'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setDraft('');
                  setError(null);
                }}
              >
                Cancel
              </Button>
            </form>
            <p className="font-mono text-[11px] text-muted-foreground/70">
              {parsedDraft.country
                ? `${parsedDraft.country.toLowerCase()} · a new number has to pass the verification call`
                : 'a new number has to pass the verification call before we ring it'}
            </p>
          </motion.div>
        ) : (
          <motion.div key="view" {...swap} className="flex w-full flex-col gap-3.5 sm:items-end">
            <div className="sm:text-right">
              <p className="flex items-center gap-1.5 font-mono text-[15px] tabular-nums sm:justify-end">
                {phone ?? 'not set'}
                {dndVerified && (
                  <motion.span
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className="flex"
                    title="verified through do not disturb"
                  >
                    <SealCheck size={15} weight="fill" className="text-live" aria-label="verified" />
                  </motion.span>
                )}
              </p>
              <p
                className={cn(
                  'mt-1.5 font-mono text-[11px]',
                  verifyPhase === 'calling'
                    ? 'text-muted-foreground'
                    : dndVerified
                      ? 'text-muted-foreground/70'
                      : 'text-destructive',
                )}
              >
                {verifyPhase === 'calling'
                  ? 'ringing your phone, press 1 when it comes through'
                  : dndVerified
                    ? 'verified through do not disturb'
                    : 'not verified, calls stay paused until this number passes the test call'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                Change number
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={phone === null || verifyPhase === 'calling'}
                onClick={() => void runVerification()}
              >
                Run verification call
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {error && <p className="w-full font-mono text-[11px] text-destructive sm:text-right">{error}</p>}
      {unreachableCountry && !error && (
        <p className="w-full max-w-sm text-[13px] leading-relaxed text-muted-foreground sm:text-right">
          We cannot place calls to {unreachableCountry} yet, so your number is unchanged. We have noted the
          country, and it counts towards which one we open next.
        </p>
      )}
    </Row>
  );
}

export default function CallSetupPage() {
  const { state, refresh } = useMe();
  const [busy, setBusy] = useState(false);
  if (state.status !== 'ready') return null;
  const { me } = state;

  async function save(patch: Record<string, unknown>) {
    setBusy(true);
    try {
      await api.updateSettings(patch);
      /* a new trigger color only dropped the sync token server-side; ask
       * google now, or the meetings list stays wrong until the next tick.
       * Best effort: the cron is still the backstop if this fails. */
      if (patch.triggerColorId !== undefined) await api.syncEvents().catch(() => undefined);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rise-in mx-auto w-full max-w-2xl py-6">
      <Shell>
        <div className="divide-y divide-border/60">
          <CalendarRow email={me.email} connected={me.calendarConnected} refresh={refresh} />

          <Row title="Trigger color" description="Events painted this color in Google Calendar get a call.">
            <TriggerColorSelect
              value={me.triggerColorId}
              disabled={busy}
              onChange={(id) => void save({ triggerColorId: id })}
            />
          </Row>

          <Row title="Lead time" description="How long before the meeting we ring.">
            <div className="inline-flex h-8 items-center gap-0.5 rounded-lg border border-border/60 bg-muted/40 p-0.5">
              {LEAD_MINUTE_OPTIONS.map((minutes) => {
                const selected = me.leadMinutes === minutes;
                return (
                  <button
                    key={minutes}
                    type="button"
                    disabled={busy}
                    aria-pressed={selected}
                    onClick={() => void save({ leadMinutes: minutes as LeadMinutes })}
                    className={cn(
                      'relative h-7 rounded-md px-3 font-mono text-[11px] tabular-nums transition-colors duration-150',
                      selected ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {selected && (
                      <motion.span
                        layoutId="lead-thumb"
                        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                        className="absolute inset-0 rounded-md border border-border/60 bg-card"
                        aria-hidden
                      />
                    )}
                    <span className="relative">{minutes} min</span>
                  </button>
                );
              })}
            </div>
          </Row>

          <PhoneRow phone={me.phone} dndVerified={me.dndVerified} refresh={refresh} />
        </div>
      </Shell>
    </div>
  );
}
