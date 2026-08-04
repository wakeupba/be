'use client';

import { useEffect, useState } from 'react';
import { BabeMark } from '@/components/brand/mark';
import { ButtonLink } from '@/components/ui/button';
import { Shell } from '@/components/ui/panel';
import { api } from '@/lib/api';
import { useMe } from '@/lib/use-me';

const LANDING = process.env.NEXT_PUBLIC_LANDING_ORIGIN ?? 'https://wakeupba.be';

/*
 * The front door. Standalone page, no app chrome: in production the gate
 * worker sends every unauthenticated document request here, and sends
 * authenticated visits on this path back to the app.
 */
export default function LoginPage() {
  const { state } = useMe();
  /* the api bounces here for the two failures a person can actually cause:
   * a sign-in code that is no longer good, and too many attempts inside the
   * rate-limit window. Saying which beats looking like the button did
   * nothing. */
  const [retry, setRetry] = useState<'stale' | 'busy' | null>(null);

  useEffect(() => {
    if (state.status === 'ready') window.location.replace('/');
  }, [state.status]);

  useEffect(() => {
    const retry = new URLSearchParams(window.location.search).get('retry');
    if (retry === 'stale' || retry === 'busy') setRetry(retry);
  }, []);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-canvas p-6">
      <Shell className="rise-in w-full max-w-sm">
        <div className="flex flex-col items-center gap-5 px-6 py-10 text-center">
          <BabeMark className="size-10" />
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Wake Up Babe</h1>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
              Sign in with the Google account that owns your calendar.
            </p>
          </div>
          <ButtonLink href={api.loginUrl()} size="lg" className="w-full">
            Sign in with Google
          </ButtonLink>
          {retry && (
            <p className="-mt-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
              {retry === 'busy'
                ? 'too many attempts just now, wait a minute and try again'
                : 'that sign in link has expired or was already used, start again'}
            </p>
          )}
          <p className="font-mono text-[10px] text-muted-foreground/60">read-only calendar access</p>
        </div>
      </Shell>
      <a
        href={LANDING}
        className="mt-6 font-mono text-[11px] text-muted-foreground/70 transition-colors duration-150 hover:text-foreground"
      >
        back to wakeupba.be
      </a>
    </main>
  );
}
