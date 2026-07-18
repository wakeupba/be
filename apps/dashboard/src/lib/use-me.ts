'use client';

import type { MeDto } from '@wakeupbabe/shared';
import { useCallback, useEffect, useState } from 'react';
import { api, UnauthorizedError } from './api';

export type MeState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'error' }
  | { status: 'ready'; me: MeDto };

export function useMe() {
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

  return { state, refresh };
}
