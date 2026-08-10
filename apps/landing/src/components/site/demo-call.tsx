'use client';

import { type CountryCode, formatPhoneDraft, listCountries, parsePhone } from '@wakeupbabe/shared/phone';
import EXAMPLE_MOBILES from 'libphonenumber-js/examples.mobile.json';
import { getExampleNumber } from 'libphonenumber-js/min';
import { ChevronDown } from 'lucide-react';
import Script from 'next/script';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

const API = process.env.NEXT_PUBLIC_API_ORIGIN ?? '';
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

const COUNTRIES = listCountries();
const KNOWN = new Set<string>(COUNTRIES.map((c) => c.iso));

type Status = 'idle' | 'calling' | 'ringing' | 'error';

interface Turnstile {
  render: (
    el: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      callback: (token: string) => void;
      theme: string;
      size: string;
      appearance: 'always' | 'execute' | 'interaction-only';
      'before-interactive-callback': () => void;
      'after-interactive-callback': () => void;
    },
  ) => string;
  reset: (id: string) => void;
}

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

/*
 * The proof. Everything else on this page asserts that a phone call gets
 * through; this rings the visitor's phone.
 *
 * Renders nothing at all until the API says the demo is available, which it
 * stops saying once the week's budget is gone. That absence is the intended
 * failure mode: a visitor sees the page without a demo rather than a demo that
 * errors, and nothing here reveals which limit was hit.
 */
export function DemoCall() {
  const [available, setAvailable] = useState<boolean | null>(null);
  /* the visitor's dialing code, preselected from where they actually are (the
   * availability response echoes Cloudflare's country) so the number they type
   * is the number they would say out loud. A typed + still overrides it. */
  const [country, setCountry] = useState<CountryCode>('US');
  const [phone, setPhone] = useState('');
  const parsed = parsePhone(phone, country);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string | null>(null);
  /* true only while Cloudflare is actually asking the visitor to do something.
   * Drives whether the widget gets any room, and which of two honest sentences
   * a missing token gets: one of them points at a widget, so it must not be
   * shown when there is no widget to point at. */
  const [challenging, setChallenging] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const token = useRef<string | null>(null);

  const dialCode = useMemo(() => COUNTRIES.find((c) => c.iso === country)?.code ?? '1', [country]);
  /* a real example mobile for the selected country, formatted the way a local
   * would write it: the placeholder teaches the expected shape better than any
   * caption, and it changes when the country does */
  const placeholder = useMemo(
    () => getExampleNumber(country, EXAMPLE_MOBILES)?.formatNational() ?? '',
    [country],
  );

  useEffect(() => {
    if (!SITE_KEY) {
      setAvailable(false);
      return;
    }
    let live = true;
    fetch(`${API}/demo/availability`)
      .then((response) => (response.ok ? response.json() : { available: false }))
      .then(async (body: { available?: boolean; country?: string | null }) => {
        if (!live) return;
        setAvailable(Boolean(body.available));
        /* Where to point the dialing code: the network's country first, and
         * when the edge does not know (unknown networks, and every local dev
         * session), the machine's timezone. Not the locale: navigator.language
         * is a language preference, and a Mac set to English (UK) in India
         * answers GB, which is exactly the wrong-by-default this preselect
         * exists to avoid. The clock tracks where the person actually is.
         *
         * The tz table is imported lazily because in production Cloudflare
         * almost always knows, so almost nobody pays for it. */
        if (body.country && KNOWN.has(body.country)) {
          setCountry(body.country as CountryCode);
          return;
        }
        try {
          const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          if (!zone) return;
          const { getTimezone } = await import('countries-and-timezones');
          const iso = getTimezone(zone)?.countries[0];
          if (live && iso && KNOWN.has(iso)) setCountry(iso as CountryCode);
        } catch {
          // US stays; a silent guess beats a wrong one
        }
      })
      .catch(() => {
        if (live) setAvailable(false);
      });
    return () => {
      live = false;
    };
  }, []);

  /* Explicit rendering, so the widget lands in our container rather than
   * wherever the script decides.
   *
   * Polled rather than driven by the script's onLoad: the load and the moment
   * this container exists are independent, and depending on whichever fires
   * last left the widget unmounted in practice. Polling is dull but it cannot
   * miss, and it stops the moment the widget exists. */
  useEffect(() => {
    if (available !== true) return;
    let cancelled = false;

    const mount = (): boolean => {
      if (cancelled || widgetId.current !== null) return true;
      if (!window.turnstile || !widgetRef.current) return false;
      widgetId.current = window.turnstile.render(widgetRef.current, {
        sitekey: SITE_KEY,
        action: 'demo-call',
        theme: 'auto',
        /* flexible fills the container, so on the rare occasion it does appear
         * it reads as part of the form rather than a slab beside it. Its floor
         * is 300px, which only a phone under ~345px cannot give it, and the
         * wrapper below handles that case rather than every width paying. */
        size: 'flexible',
        /*
         * The widget is chrome for a check that almost never needs a human, and
         * as permanent furniture it was the loudest thing on the card: a grey
         * panel with a green tick and an orange logo, in a page that spends one
         * accent deliberately and owns neither of those hues. It also sat inside
         * the card's border, so it read as a second box in a first box.
         *
         * interaction-only keeps the check and drops the furniture. Cloudflare
         * still runs it, siteverify is unchanged, and a suspected bot still gets
         * an interactive challenge. Most visitors simply never see one.
         */
        appearance: 'interaction-only',
        'before-interactive-callback': () => setChallenging(true),
        'after-interactive-callback': () => setChallenging(false),
        callback: (solved) => {
          token.current = solved;
          setChallenging(false);
        },
      });
      return widgetId.current !== null;
    };

    if (mount()) return;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      // give up rather than poll forever if the script is blocked outright
      if (mount() || Date.now() - startedAt > 15_000) clearInterval(timer);
    }, 150);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [available]);

  function edit(raw: string) {
    const next = formatPhoneDraft(raw, country);
    setPhone(next);
    /* a typed + names its own country, and the select follows so the two
     * never disagree about what is being dialled */
    if (next.startsWith('+')) {
      const typed = parsePhone(next, country);
      if (typed.iso && typed.iso !== country) setCountry(typed.iso);
    }
    /* editing the number retires the last refusal: otherwise the accent line
     * sat there while a new number was typed */
    if (status === 'error') setStatus('idle');
    if (message !== null) setMessage(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!token.current) {
      /* An error state, not a hint: the submit did not happen, so this has to
       * read differently from "keep typing".
       *
       * Which sentence depends on whether there is anything to point at. The
       * widget is hidden unless Cloudflare wants an interaction, so telling
       * everyone to "finish the check below" would send most people looking for
       * something that is not there. Without a challenge on screen the honest
       * answer is that the check has not come back yet. */
      setStatus('error');
      setMessage(
        challenging
          ? 'finish the check just below, then try again'
          : 'still checking this browser, one second',
      );
      return;
    }
    setStatus('calling');
    setMessage(null);
    try {
      const response = await fetch(`${API}/demo/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        /* owns is the ownership attestation the API refuses without, stored on
         * the call. It used to be a checkbox; it is now the press itself, made
         * directly under the sentence that spells it out. The artifact is the
         * same fact either way: a human asserted this number was theirs at the
         * moment they asked us to ring it. */
        body: JSON.stringify({ phone: parsed.e164, token: token.current, owns: true }),
      });
      if (response.ok) {
        setStatus('ringing');
        return;
      }
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setStatus('error');
      setMessage(body?.error ?? 'that did not go through');
    } catch {
      setStatus('error');
      setMessage('that did not go through');
    } finally {
      /* a token is single use, so the widget has to mint a fresh one whether
       * this attempt worked or not */
      token.current = null;
      if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
    }
  }

  /* null while we are still asking, and null forever once the week is spent.
   * The section owns its own padding for exactly this reason: an outer wrapper
   * would leave a gap where the demo used to be. */
  if (available !== true) return null;

  return (
    <section id="demo">
      {/* pulled up under the steps on purpose: this is the payoff of having just
       * read how it works, and left in its own band it read as a stray card in
       * a gap. The section below supplies the space underneath */}
      {/* wide enough that the description holds two lines and the form sits in
       * one clear row; the pb is the card's own breathing room before the next
       * band, which pb-4 did not give it */}
      <div className="mx-auto -mt-12 max-w-2xl px-6 pb-14 sm:-mt-16">
        {/* One announcer for the whole section, mounted from the start and never
         * unmounted. The visible cards carry no live region of their own: they
         * are created at the same moment as their text, which is precisely when
         * a screen reader will not announce them. */}
        <p aria-live="polite" className="sr-only">
          {status === 'ringing' ? 'Your phone is ringing.' : (message ?? '')}
        </p>
        {status === 'ringing' ? (
          <div className="rounded-2xl border border-line-soft bg-background p-6 sm:p-8">
            <p className="text-[17px] font-semibold">Your phone is ringing.</p>
            <p className="mt-1 font-mono text-[12px] text-muted-2">
              that is the whole product. pick up, then come back
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-line-soft bg-background p-6 sm:p-8">
            <div className="flex flex-col gap-2">
              {/* one tier above the body copy: this card is the page's payoff,
               * and at the body size it read as one more paragraph */}
              <p className="text-[17px] font-semibold tracking-tight">Hear it for yourself</p>
              {/* says what the code does: the cap needs a way to recognise the
               * number, so a one-way fingerprint is kept. Claiming we keep
               * nothing was disprovable from the sentence before it */}
              <p className="text-[14px] text-muted">
                Put in your number and your phone rings in seconds. We keep a one-way fingerprint of it so the
                same number cannot be rung repeatedly, and nothing else.
              </p>
            </div>
            <form onSubmit={submit} className="mt-5 flex flex-col gap-2.5 sm:flex-row">
              <div className="flex min-w-0 grow gap-2.5">
                {/* A native select wearing a compact face: the chip shows the
                 * dialing code, the real control sits invisible on top of it, so
                 * keyboards, screen readers and phones all get the platform
                 * picker instead of a 240-item styled listbox. No flags: the
                 * code plus the option's name is the information, and a flag
                 * strip is a hue the palette does not own. */}
                {/* the ring only for keyboard focus: focus-within also fires on
                 * a mouse pick and then sits on the chip for as long as the
                 * select holds focus, which read as a stuck double border */}
                <div className="relative flex h-9 shrink-0 items-center gap-1 rounded-lg border border-line bg-background pr-2 pl-3 font-mono text-sm tabular-nums has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-foreground/40">
                  <span>+{dialCode}</span>
                  <ChevronDown className="size-3.5 text-muted-2" aria-hidden />
                  <select
                    value={country}
                    onChange={(event) => {
                      const next = event.target.value as CountryCode;
                      setCountry(next);
                      // digits already typed re-read under the new country
                      setPhone((current) => formatPhoneDraft(current.replace(/^\+\d*\s*/, ''), next));
                    }}
                    aria-label="Country"
                    className="absolute inset-0 w-full cursor-pointer opacity-0"
                  >
                    {COUNTRIES.map((option) => (
                      <option key={option.iso} value={option.iso}>
                        {option.name} (+{option.code})
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(event) => edit(event.target.value)}
                  placeholder={placeholder}
                  aria-label="Your phone number"
                  aria-invalid={phone.length > 3 && !parsed.valid}
                  className="h-9 w-full min-w-0 grow rounded-lg border border-line bg-background px-3 font-mono text-sm tabular-nums placeholder:text-muted-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/40"
                />
              </div>
              {/* min width pinned so Calling does not shrink the button */}
              <Button
                type="submit"
                variant="accent"
                className="sm:min-w-[7.5rem]"
                disabled={status === 'calling' || !parsed.valid}
              >
                {status === 'calling' ? 'Calling' : 'Call me now'}
              </Button>
            </form>
            {/* Three jobs, one line, held to one height: the ownership
             * attestation at rest (the sentence the button is pressed under,
             * which is what `owns` in the request means), progress while a
             * number is partial, and the refusal afterwards, in the accent so a
             * demo that failed stops reading like a demo that is waiting.
             * Contrast is measured: 4.83:1 on white, 6.16:1 on dark. */}
            <p
              className={`mt-2.5 min-h-[1lh] font-mono text-[12px] ${
                status === 'error' ? 'text-accent' : 'text-muted-2'
              }`}
            >
              {message ??
                (phone && !parsed.valid ? 'keep typing' : 'pressing call confirms this number is yours')}
            </p>
            {/* Takes no room at all until Cloudflare wants an interaction, which
             * for almost everyone is never. The margin is conditional for the
             * same reason: an empty container still pushed a gap into the card.
             * The clip stays regardless: Turnstile owns its own dimensions, and
             * a future size change must not be able to scroll the page
             * sideways. */}
            <div className={`overflow-hidden ${challenging ? 'mt-3' : ''}`}>
              <div ref={widgetRef} />
            </div>
          </div>
        )}
      </div>
      {/* only mounted once availability said yes, so a visitor who will never
       * see a demo never pays for the script */}
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="lazyOnload"
      />
    </section>
  );
}
