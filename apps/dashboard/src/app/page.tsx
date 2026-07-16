'use client';

import type { CallHistoryDto, MeDto, UpcomingEventDto } from '@wakeupbabe/shared';
import { useEffect, useState } from 'react';
import { api, UnauthorizedError } from '@/lib/api';

type LoadState = 'loading' | 'anonymous' | 'ready' | 'error';

/**
 * Functional shell only. Proves the auth session, API wiring and data flow
 * end to end; the actual dashboard design is a separate pass.
 */
export default function DashboardPage() {
  const [state, setState] = useState<LoadState>('loading');
  const [me, setMe] = useState<MeDto | null>(null);
  const [events, setEvents] = useState<UpcomingEventDto[]>([]);
  const [calls, setCalls] = useState<CallHistoryDto[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const profile = await api.me();
        setMe(profile);
        const [upcoming, history] = await Promise.all([api.events(), api.calls()]);
        setEvents(upcoming);
        setCalls(history);
        setState('ready');
      } catch (error) {
        setState(error instanceof UnauthorizedError ? 'anonymous' : 'error');
      }
    })();
  }, []);

  if (state === 'loading') return <p>waking up...</p>;
  if (state === 'error') return <p>something broke. refresh, babe.</p>;
  if (state === 'anonymous' || !me) {
    return (
      <main>
        <h1>Wake Up Babe</h1>
        <p>Your calendar, but clingy.</p>
        <a href={api.loginUrl()}>Sign in with Google</a>
      </main>
    );
  }

  return (
    <main>
      <h1>hey, {me.displayName ?? me.email}</h1>
      <p>
        plan: {me.plan} · calls used: {me.callsUsed}/{me.callsLimit}
        {me.extraCredits > 0 ? ` (+${me.extraCredits} credits)` : ''}
      </p>
      {!me.dndVerified && <p>⚠️ finish setup: add your number and run the verification call.</p>}

      <h2>upcoming calls</h2>
      {events.length === 0 ? (
        <p>no flagged meetings. color one red and it shows up here within 5 minutes.</p>
      ) : (
        <ul>
          {events.map((event) => (
            <li key={event.id}>
              {event.title} · rings at {new Date(event.callAt).toLocaleString()} · {event.state}
            </li>
          ))}
        </ul>
      )}

      <h2>call history</h2>
      {calls.length === 0 ? (
        <p>no calls yet.</p>
      ) : (
        <ul>
          {calls.map((call) => (
            <li key={call.id}>
              {call.eventTitle} · attempt {call.attempt} · {call.outcome}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
