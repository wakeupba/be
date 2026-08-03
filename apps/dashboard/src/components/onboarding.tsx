'use client';

import { AddressBook, Check } from '@phosphor-icons/react';
import type { MeDto } from '@wakeupbabe/shared';
import { motion } from 'motion/react';
import QRCode from 'qrcode';
import { useEffect, useRef, useState } from 'react';
import { Button, ButtonLink } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Panel, Shell } from '@/components/ui/panel';
import { api } from '@/lib/api';
import { formatPhoneDraft, parsePhone } from '@/lib/phone';
import { cn } from '@/lib/utils';

const API = process.env.NEXT_PUBLIC_API_ORIGIN ?? '';

type StepId = 'phone' | 'contact' | 'verify';

function stepStates(me: MeDto, contactSaved: boolean): Record<StepId, 'done' | 'active' | 'todo'> {
  if (!me.phone) return { phone: 'active', contact: 'todo', verify: 'todo' };
  if (!contactSaved) return { phone: 'done', contact: 'active', verify: 'todo' };
  if (!me.dndVerified) return { phone: 'done', contact: 'done', verify: 'active' };
  return { phone: 'done', contact: 'done', verify: 'done' };
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

function PhoneStep({ onSaved }: { onSaved: () => void }) {
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
          try {
            await api.updateSettings({ phone: parsed.e164 });
            onSaved();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'could not save');
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
  const setupUrl = typeof window === 'undefined' ? '' : `${window.location.origin}/m/setup/`;

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
            scan with your phone
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

function VerifyStep({ refresh }: { refresh: () => Promise<MeDto | null> }) {
  const [phase, setPhase] = useState<'idle' | 'calling' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (phase !== 'calling') return;
    const interval = setInterval(async () => {
      const me = await refresh();
      if (me?.dndVerified) clearInterval(interval);
    }, 3000);
    return () => clearInterval(interval);
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
            setError(null);
            try {
              await api.verifyCall();
              setPhase('calling');
            } catch (err) {
              setPhase('error');
              setError(err instanceof Error ? err.message : 'call failed');
            }
          }}
        >
          {phase === 'calling' ? 'Calling your phone' : 'Call me now'}
        </Button>
        {phase === 'calling' && (
          <p className="font-mono text-[11px] text-muted-foreground/70">waiting for you to press 1</p>
        )}
      </div>
      {error && <p className="mt-2 font-mono text-[11px] text-destructive">{error}</p>}
    </div>
  );
}

export function Onboarding({ me, refresh }: { me: MeDto; refresh: () => Promise<MeDto | null> }) {
  const [contactSaved, setContactSaved] = useState(false);
  const steps = stepStates(me, contactSaved);

  const rows: Array<{ id: StepId; number: string; title: string; body: React.ReactNode }> = [
    {
      id: 'phone',
      number: '1',
      title: 'Your phone number',
      body: <PhoneStep onSaved={() => void refresh()} />,
    },
    {
      id: 'contact',
      number: '2',
      title: 'Save us as a contact',
      body: <ContactStep brandNumber={me.brandNumber} onDone={() => setContactSaved(true)} />,
    },
    {
      id: 'verify',
      number: '3',
      title: 'Prove it rings through DND',
      body: <VerifyStep refresh={refresh} />,
    },
  ];

  return (
    <div className="rise-in mx-auto w-full max-w-2xl py-6">
      <p className="label-mono text-muted-foreground/70">Setup</p>
      <h1 className="mt-2 text-xl font-semibold tracking-tight">
        Three steps and your calendar can call you.
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
