'use client';

import type { MeDto } from '@wakeupbabe/shared';
import { useCallback, useEffect, useState } from 'react';
import { api, UnauthorizedError } from './api';

export type MeState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'error' }
  | { status: 'ready'; me: MeDto };

/*
 * options.required marks a page as auth-gated: anonymous visitors get sent
 * to /login. In production the gate worker already redirects before any HTML
 * is served; this client fallback covers plain `next dev`.
 */
export function useMe(options?: { required?: boolean }) {
  const required = options?.required ?? false;
  const [state, setState] = useState<MeState>({ status: 'loading' });

  const refresh = useCallback(async () => {
    try {
      const me = await api.me();
      setState({ status: 'ready', me });
      return me;
    } catch (error) {
      setState({ status: error instanceof UnauthorizedError ? 'anonymous' : 'error' });
      return null;
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (required && state.status === 'anonymous') window.location.replace('/login/');
  }, [required, state.status]);

  return { state, refresh };
}
