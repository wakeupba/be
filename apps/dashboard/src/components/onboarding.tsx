'use client';

import { AddressBook, Check } from '@phosphor-icons/react';
import type { MeDto } from '@wakeupbabe/shared';
import { motion } from 'motion/react';
import QRCode from 'qrcode';
import { useEffect, useRef, useState } from 'react';
import { Button, ButtonLink } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Panel, Shell } from '@/components/ui/panel';
import { ApiError, api } from '@/lib/api';
import { formatPhoneDraft, parsePhone } from '@/lib/phone';
import { cn } from '@/lib/utils';

const API = process.env.NEXT_PUBLIC_API_ORIGIN ?? '';

type StepId = 'calendar' | 'phone' | 'contact' | 'verify';

function stepStates(me: MeDto, contactSaved: boolean): Record<StepId, 'done' | 'active' | 'todo'> {
  if (!me.calendarConnected) return { calendar: 'active', phone: 'todo', contact: 'todo', verify: 'todo' };
  if (!me.phone) return { calendar: 'done', phone: 'active', contact: 'todo', verify: 'todo' };
  if (!contactSaved) return { calendar: 'done', phone: 'done', contact: 'active', verify: 'todo' };
  if (!me.dndVerified) return { calendar: 'done', phone: 'done', contact: 'done', verify: 'active' };
  return { calendar: 'done', phone: 'done', contact: 'done', verify: 'done' };
}

function StepMarker({ state, number }: { state: 'done' | 'active' | 'todo'; number: string }) {
  return (
    <span
      className={cn(
        'flex size-6 shrink-0 items-center justify-center rounded-full border font-mono text-[11px]',
        state === 'done' && 'border-live/30 bg-live/10 text-live',
        state === 'active' && 'border-foreground bg-foreground text-background',
        state === 'todo' && 'border-border/60 text-muted-foreground/60',
      )}
    >
      {state === 'done' ? (
        <motion.span
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="flex"
        >
          <Check size={14} weight="bold" aria-hidden />
        </motion.span>
      ) : (
        number
      )}
    </span>
  );
}

function CalendarStep() {
  return (
    <div className="max-w-md">
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        We can only call you about meetings we can see, so the calendar box on Google's screen has to stay
        checked this time.
      </p>
      <div className="mt-4">
        <ButtonLink href={api.loginUrl()} size="sm">
          Connect Google Calendar
        </ButtonLink>
      </div>
    </div>
  );
}

function PhoneStep({ onSaved }: { onSaved: () => void }) {
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // a country we cannot ring yet is not a mistake the user made, so it reads as
  // a status rather than an error, and the field stays open in case they meant
  // a different number
  const [unreachableCountry, setUnreachableCountry] = useState<string | null>(null);
  const parsed = parsePhone(phone);

  return (
    <div className="max-w-sm">
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        The number we will call. Use international format, like +14155550123.
      </p>
      <form
        className="mt-3 flex gap-2"
        onSubmit={async (event) => {
          event.preventDefault();
          setSaving(true);
          setError(null);
          setUnreachableCountry(null);
          try {
            await api.updateSettings({ phone: parsed.e164 });
            onSaved();
          } catch (err) {
            if (err instanceof ApiError && err.code === 'region_unsupported') {
              setUnreachableCountry(parsed.country ?? 'your country');
            } else {
              setError(err instanceof Error ? err.message : 'could not save');
            }
          } finally {
            setSaving(false);
          }
        }}
      >
        <Input
          type="tel"
          value={phone}
          onChange={(event) => setPhone(formatPhoneDraft(event.target.value))}
          placeholder="+14155550123"
          aria-label="Your phone number"
          aria-invalid={phone.length > 3 && !parsed.valid}
          className="font-mono tabular-nums"
        />
        <Button type="submit" disabled={!parsed.valid || saving}>
          {saving ? 'Saving' : 'Save'}
        </Button>
      </form>
      {error ? (
        <p className="mt-2 font-mono text-[11px] text-destructive">{error}</p>
      ) : unreachableCountry ? (
        <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
          We cannot place calls to {unreachableCountry} yet. We have noted the country, and it counts towards
          which one we open next. If you have a number somewhere else, try that one.
        </p>
      ) : parsed.country ? (
        <p className="mt-2 font-mono text-[11px] text-muted-foreground/70">
          {parsed.valid ? parsed.country : `${parsed.country} · keep typing`}
        </p>
      ) : null}
    </div>
  );
}

function ContactStep({ brandNumber, onDone }: { brandNumber: string; onDone: () => void }) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [qr, setQr] = useState<string | null>(null);
  // in prod the setup page lives on its own domain hack; dev has no such
  // domain, so the QR falls back to this origin's copy of the page
  // ?babe is the key: without it the domain plays hard to get and redirects
  const setupUrl =
    typeof window === 'undefined'
      ? ''
      : window.location.hostname === 'app.wakeupba.be'
        ? 'https://pickuptheph.one/?babe'
        : `${window.location.origin}/m/setup/`;

  useEffect(() => {
    if (!setupUrl) return;
    QRCode.toDataURL(setupUrl, { margin: 1, width: 168 })
      .then(setQr)
      .catch(() => setQr(null));
  }, [setupUrl]);

  return (
    <div ref={canvasRef}>
      <p className="max-w-md text-[13px] leading-relaxed text-muted-foreground">
        Save our number on your phone and allow it through Do Not Disturb. This is what lets the call ring
        when everything else is silenced.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-[auto_1fr]">
        <Panel className="hidden place-items-center p-4 sm:grid">
          {qr ? (
            // biome-ignore lint/performance/noImgElement: data-URL QR code, next/image adds nothing
            <img src={qr} alt="QR code opening the phone setup page" className="size-[168px]" />
          ) : (
            <div className="size-[168px]" />
          )}
          <p className="mt-2 text-center font-mono text-[10px] text-muted-foreground/70">
            {setupUrl.startsWith('https://pickuptheph.one') ? 'pickuptheph.one' : 'scan with your phone'}
          </p>
        </Panel>
        <div className="flex flex-col gap-2.5">
          <Panel className="p-4">
            <p className="label-mono text-muted-foreground">The number</p>
            <p className="mt-2 font-mono text-[17px] tabular-nums">{brandNumber}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <ButtonLink href={`${API}/contact.vcf`} variant="outline" size="sm">
                <AddressBook size={14} aria-hidden />
                Download contact card
              </ButtonLink>
            </div>
          </Panel>
          <Panel className="p-4">
            <p className="label-mono text-muted-foreground">Allow through DND</p>
            <ul className="mt-2 flex flex-col gap-1.5 text-[13px] leading-relaxed text-muted-foreground">
              <li>
                <span className="text-foreground">iPhone:</span> open the contact, Edit, Ringtone, turn on
                Emergency Bypass.
              </li>
              <li>
                <span className="text-foreground">Android:</span> star the contact, then allow starred
                contacts in Do Not Disturb settings.
              </li>
            </ul>
          </Panel>
          <Button className="self-start" onClick={onDone}>
            Done, contact saved
          </Button>
        </div>
      </div>
    </div>
  );
}

const VERIFY_POLL_MS = 3000;
const VERIFY_TIMEOUT_MS = 90_000;

/** answered but 1 was never pressed, or never answered at all */
const MISSED_OUTCOMES = new Set(['no_answer', 'answered_no_input', 'answered_snooze']);

function VerifyStep({ refresh }: { refresh: () => Promise<MeDto | null> }) {
  const [phase, setPhase] = useState<'idle' | 'calling' | 'missed'>('idle');
  const [notice, setNotice] = useState<{ text: string; tone: 'muted' | 'destructive' } | null>(null);
  const callIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (phase !== 'calling') return;
    const startedAt = Date.now();
    let active = true;
    let busy = false;
    const interval = setInterval(async () => {
      if (busy) return;
      busy = true;
      try {
        const me = await refresh().catch(() => null);
        if (!active) return;
        // success: the parent sees dndVerified and swaps this step to done;
        // stop polling now instead of waiting for the unmount
        if (me?.dndVerified) {
          active = false;
          clearInterval(interval);
          return;
        }

        const callId = callIdRef.current;
        const call = callId ? await api.callOutcome(callId).catch(() => null) : null;
        if (!active) return;

        if (call && MISSED_OUTCOMES.has(call.outcome)) {
          setPhase('missed');
          setNotice({
            text: "didn't catch you, or 1 wasn't pressed. turn on DND and try again",
            tone: 'muted',
          });
        } else if (call?.outcome === 'failed') {
          setPhase('missed');
          setNotice({
            text: 'the call could not be placed. check your number and try again',
            tone: 'destructive',
          });
        } else if (Date.now() - startedAt > VERIFY_TIMEOUT_MS) {
          setPhase('missed');
          setNotice({ text: 'we lost track of that call. try again', tone: 'muted' });
        }
      } finally {
        busy = false;
      }
    }, VERIFY_POLL_MS);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [phase, refresh]);

  return (
    <div className="max-w-md">
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        Turn on Do Not Disturb now. Then request the test call: if your phone rings through, press 1 and you
        are live. We only activate accounts that pass this.
      </p>
      <div className="mt-4 flex items-center gap-3">
        <Button
          disabled={phase === 'calling'}
          onClick={async () => {
            setNotice(null);
            try {
              const { callId } = await api.verifyCall();
              callIdRef.current = callId;
              setPhase('calling');
            } catch (err) {
              setPhase('idle');
              setNotice({
                text: err instanceof Error ? err.message : 'call failed',
                tone: 'destructive',
              });
            }
          }}
        >
          {phase === 'calling' ? 'Calling your phone' : phase === 'missed' ? 'Call me again' : 'Call me now'}
        </Button>
        {phase === 'calling' && (
          <p className="font-mono text-[11px] text-muted-foreground/70">waiting for you to press 1</p>
        )}
      </div>
      <p
        className={cn(
          'mt-2 min-h-[1lh] font-mono text-[11px]',
          notice?.tone === 'destructive' ? 'text-destructive' : 'text-muted-foreground/70',
        )}
      >
        {notice?.text}
      </p>
    </div>
  );
}

export function Onboarding({ me, refresh }: { me: MeDto; refresh: () => Promise<MeDto | null> }) {
  const [contactSaved, setContactSaved] = useState(false);
  const steps = stepStates(me, contactSaved);

  const rows: Array<{ id: StepId; number: string; title: string; body: React.ReactNode }> = [
    {
      id: 'calendar',
      number: '1',
      title: 'Connect your calendar',
      body: <CalendarStep />,
    },
    {
      id: 'phone',
      number: '2',
      title: 'Your phone number',
      body: <PhoneStep onSaved={() => void refresh()} />,
    },
    {
      id: 'contact',
      number: '3',
      title: 'Save us as a contact',
      body: <ContactStep brandNumber={me.brandNumber} onDone={() => setContactSaved(true)} />,
    },
    {
      id: 'verify',
      number: '4',
      title: 'Prove it rings through DND',
      body: <VerifyStep refresh={refresh} />,
    },
  ];

  return (
    <div className="rise-in mx-auto w-full max-w-2xl py-6">
      <p className="label-mono text-muted-foreground/70">Setup</p>
      <h1 className="mt-2 text-xl font-semibold tracking-tight">
        A few steps and your calendar can call you.
      </h1>
      <div className="mt-6 flex flex-col gap-3">
        {rows.map((row) => (
          <Shell key={row.id}>
            <div className="p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <StepMarker state={steps[row.id]} number={row.number} />
                <h2
                  className={cn(
                    'text-[15px] font-semibold',
                    steps[row.id] === 'todo' && 'text-muted-foreground/60',
                  )}
                >
                  {row.title}
                </h2>
              </div>
              {steps[row.id] === 'active' && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="mt-4 pl-9"
                >
                  {row.body}
                </motion.div>
              )}
            </div>
          </Shell>
        ))}
      </div>
    </div>
  );
}
