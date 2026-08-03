'use client';

import type { MeDto } from '@wakeupbabe/shared';
import { useEffect, useSyncExternalStore } from 'react';
import { api, UnauthorizedError } from './api';

export type MeState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'error' }
  | { status: 'ready'; me: MeDto };

/*
 * One module-level session store shared by every component that asks who the
 * user is. The first mount fetches /me; every later mount (route changes, the
 * shell, pages) reads the cached value synchronously, so navigating between
 * tabs never flashes the sidebar back to a logged-out skeleton. refresh()
 * revalidates in place and concurrent callers share one request.
 */
let state: MeState = { status: 'loading' };
let inflight: Promise<MeDto | null> | null = null;
let fetchedOnce = false;
const listeners = new Set<() => void>();

function setState(next: MeState) {
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): MeState {
  return state;
}

async function load(): Promise<MeDto | null> {
  try {
    const me = await api.me();
    setState({ status: 'ready', me });
    return me;
  } catch (error) {
    setState({ status: error instanceof UnauthorizedError ? 'anonymous' : 'error' });
    return null;
  } finally {
    inflight = null;
  }
}

export function refreshMe(): Promise<MeDto | null> {
  inflight ??= load();
  return inflight;
}

/* forget the session, e.g. after logout */
export function clearMe() {
  fetchedOnce = false;
  inflight = null;
  setState({ status: 'loading' });
}

/*
 * options.required marks a page as auth-gated: anonymous visitors get sent
 * to /login. In production the gate worker already redirects before any HTML
 * is served; this client fallback covers plain `next dev`.
 */
export function useMe(options?: { required?: boolean }) {
  const required = options?.required ?? false;
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (!fetchedOnce) {
      fetchedOnce = true;
      void refreshMe();
    }
  }, []);

  useEffect(() => {
    if (required && snapshot.status === 'anonymous') window.location.replace('/login/');
  }, [required, snapshot.status]);

  return { state: snapshot, refresh: refreshMe };
}
