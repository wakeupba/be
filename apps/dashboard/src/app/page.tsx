'use client';

import { AppShell } from '@/components/app-shell';
import { Onboarding } from '@/components/onboarding';
import { Overview } from '@/components/overview';
import { useMe } from '@/lib/use-me';

export default function DashboardPage() {
  const { state, refresh } = useMe({ required: true });

  if (state.status === 'error') {
    return (
      <AppShell me={null}>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-[13px] text-muted-foreground">
            The API is not reachable right now. Refresh in a moment.
          </p>
        </div>
      </AppShell>
    );
  }
  if (state.status !== 'ready') {
    return <AppShell me={null}>{null}</AppShell>;
  }

  const { me } = state;
  const onboarded = me.phone !== null && me.dndVerified;

  return (
    <AppShell me={me} title={onboarded ? 'Overview' : 'Setup'}>
      {onboarded ? <Overview me={me} /> : <Onboarding me={me} refresh={refresh} />}
    </AppShell>
  );
}
