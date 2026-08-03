'use client';

import { MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/app-shell';
import { useMe } from '@/lib/use-me';

/*
 * The shell mounts once here and survives route changes: the sidebar (and its
 * usage meter) never remounts on navigation, and the active-nav pill can
 * slide between items. Pages inside the group read the same cached session.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  const { state } = useMe({ required: true });

  return (
    <MotionConfig reducedMotion="user">
      <AppShell me={state.status === 'ready' ? state.me : null}>
        {state.status === 'ready' ? (
          children
        ) : state.status === 'error' ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-[13px] text-muted-foreground">
              The API is not reachable right now. Refresh in a moment.
            </p>
          </div>
        ) : null}
      </AppShell>
    </MotionConfig>
  );
}
