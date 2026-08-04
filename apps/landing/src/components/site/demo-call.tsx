'use client';

import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

const API = process.env.NEXT_PUBLIC_API_ORIGIN ?? '';
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

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
  const [phone, setPhone] = useState('');
  const [owns, setOwns] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const token = useRef<string | null>(null);

  useEffect(() => {
    if (!SITE_KEY) {
      setAvailable(false);
      return;
    }
    let live = true;
    fetch(`${API}/demo/availability`)
      .then((response) => (response.ok ? response.json() : { available: false }))
      .then((body: { available?: boolean }) => {
        if (live) setAvailable(Boolean(body.available));
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
        /* compact is ~150px, so it fits the narrowest card we render without
         * clipping or scaling. The scale-90 this replaced would have shrunk the
         * checkbox with it, and a Turnstile checkbox is already close to the
         * 24px floor WCAG 2.5.8 asks for. */
        size: 'compact',
        callback: (solved) => {
          token.current = solved;
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

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!token.current) {
      setMessage('finish the check just below, then try again');
      return;
    }
    setStatus('calling');
    setMessage(null);
    try {
      const response = await fetch(`${API}/demo/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // owns goes to the server, which requires it: the attestation is a
        // property of the call, not of this browser session
        body: JSON.stringify({ phone, token: token.current, owns }),
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
      <div className="mx-auto -mt-12 max-w-xl px-6 pb-4 sm:-mt-16">
        {/* One announcer for the whole section, mounted from the start and never
         * unmounted. The visible cards carry no live region of their own: they
         * are created at the same moment as their text, which is precisely when
         * a screen reader will not announce them. */}
        <p aria-live="polite" className="sr-only">
          {status === 'ringing' ? 'Your phone is ringing.' : (message ?? '')}
        </p>
        {status === 'ringing' ? (
          <div className="rounded-2xl border border-line-soft bg-background p-6">
            <p className="text-[15px] font-medium">Your phone is ringing.</p>
            <p className="mt-1 font-mono text-[12px] text-muted-2">
              that is the whole product. pick up, then come back
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-line-soft bg-background p-6">
            <div className="flex flex-col gap-1.5">
              <p className="text-[15px] font-medium">Hear it for yourself</p>
              {/* says what the code does: the cap needs a way to recognise the
               * number, so a one-way fingerprint is kept. Claiming we keep
               * nothing was disprovable from the sentence before it */}
              <p className="text-[14px] text-muted">
                Put in your own number and we will call you now. We keep a one-way fingerprint of it so the
                same number cannot be rung repeatedly, and nothing else.
              </p>
            </div>
            <form onSubmit={submit} className="mt-4 flex flex-col gap-2.5 sm:flex-row">
              <input
                type="tel"
                required
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+14155550123"
                aria-label="Your phone number"
                className="h-9 grow rounded-lg border border-line bg-background px-3 font-mono text-sm tabular-nums placeholder:text-muted-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/40"
              />
              <Button type="submit" disabled={status === 'calling' || !owns || phone.length < 8}>
                {status === 'calling' ? 'Calling' : 'Call me now'}
              </Button>
            </form>
            {/* This does not create consent from whoever answers, and it is not
             * pretended to. What it does is turn "no record" into a statement
             * made at the point of entry, which is the part that matters if this
             * is ever questioned. It is sent with the request and stored on the
             * call, and the API refuses without it, so it is a fact about the
             * call rather than a button this page disabled. */}
            <label className="mt-3 flex cursor-pointer items-start gap-2 text-[13px] text-muted">
              <input
                type="checkbox"
                checked={owns}
                onChange={(event) => setOwns(event.target.checked)}
                className="mt-0.5 size-3.5 shrink-0 accent-foreground"
              />
              This is my own phone number.
            </label>
            {/* the compact widget is ~150px so it fits any card we render, but
             * the clip stays: Turnstile controls its own dimensions and a future
             * size change should not be able to scroll the page sideways */}
            <div className="mt-3 overflow-hidden">
              <div ref={widgetRef} />
            </div>
            {/* height reserved so the card does not resize when a refusal
             * appears; the announcing is done by the region above */}
            <p className="mt-2.5 min-h-[1lh] font-mono text-[12px] text-muted-2">{message}</p>
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
