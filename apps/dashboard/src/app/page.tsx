'use client';

import { AppShell } from '@/components/app-shell';
import { BabeMark } from '@/components/brand/mark';
import { Onboarding } from '@/components/onboarding';
import { Overview } from '@/components/overview';
import { ButtonLink } from '@/components/ui/button';
import { Shell } from '@/components/ui/panel';
import { api } from '@/lib/api';
import { useMe } from '@/lib/use-me';

function SignIn() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Shell className="rise-in w-full max-w-sm">
        <div className="flex flex-col items-center gap-4 px-6 py-10 text-center">
          <BabeMark className="size-10" />
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Wake Up Babe</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Sign in with the Google account that owns your calendar.
            </p>
          </div>
          <ButtonLink href={api.loginUrl()} size="lg">
            Sign in with Google
          </ButtonLink>
          <p className="font-mono text-[10px] text-muted-foreground/60">read-only calendar access</p>
        </div>
      </Shell>
    </div>
  );
}

export default function DashboardPage() {
  const { state, refresh } = useMe();

  if (state.status === 'loading') {
    return <AppShell me={null}>{null}</AppShell>;
  }
  if (state.status === 'anonymous' || state.status === 'error') {
    return (
      <AppShell me={null}>
        <SignIn />
      </AppShell>
    );
  }

  const { me } = state;
  const onboarded = me.phone !== null && me.dndVerified;

  return (
    <AppShell me={me} title={onboarded ? 'Overview' : 'Setup'}>
      {onboarded ? <Overview me={me} /> : <Onboarding me={me} refresh={refresh} />}
    </AppShell>
  );
}
