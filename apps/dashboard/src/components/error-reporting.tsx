'use client';

import { scrubEvent } from '@wakeupbabe/shared/scrub';
import { useEffect } from 'react';

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN ?? '';

/*
 * Client-side error reporting, and nothing else: no tracing, no replay, no
 * analytics. This app schedules phone calls for meetings people cannot afford
 * to miss, so a broken dashboard has to reach us before the missed meeting
 * does. The API has had this wired since launch; the day this component was
 * written, the dashboard shipped a build that fetched its session from
 * localhost and nothing reported it, which is the argument in one sentence.
 *
 * The SDK loads as its own async chunk, gated on the DSN, so a build without
 * one ships nothing extra. The gap that leaves, errors thrown before the chunk
 * arrives, is covered by two plain listeners that queue whatever happens early
 * and hand it to the SDK once it is up. That is the same trick Sentry's CDN
 * loader does, without the third-party script tag.
 *
 * A DSN is public by construction: it can only submit events, and it ships in
 * this bundle either way. sendDefaultPii stays false, so no IPs and no user
 * identity ride along with a stack trace.
 */
export function ErrorReporting() {
  useEffect(() => {
    if (!DSN) return;

    const early: unknown[] = [];
    const onError = (event: ErrorEvent) => early.push(event.error ?? event.message);
    const onRejection = (event: PromiseRejectionEvent) => early.push(event.reason);
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);

    let live = true;
    import('@sentry/browser').then((Sentry) => {
      // the SDK's own global handlers take over from here
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
      if (!live) return;
      Sentry.init({
        dsn: DSN,
        environment: 'production',
        tracesSampleRate: 0,
        sendDefaultPii: false,
        /* the same mask the worker applies: exception messages can carry the
         * one thing this app knows about you, your phone number, and the
         * privacy page says reports carry no identity */
        beforeSend: (event) => scrubEvent(event),
      });
      for (const caught of early) Sentry.captureException(caught);
      early.length = 0;
    });

    return () => {
      live = false;
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}
