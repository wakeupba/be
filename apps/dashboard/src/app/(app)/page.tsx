'use client';

import { Onboarding } from '@/components/onboarding';
import { Overview } from '@/components/overview';
import { useMe } from '@/lib/use-me';

export default function DashboardPage() {
  const { state, refresh } = useMe();
  if (state.status !== 'ready') return null;

  const { me } = state;
  const onboarded = me.phone !== null && me.dndVerified;

  return onboarded ? <Overview me={me} /> : <Onboarding me={me} refresh={refresh} />;
}
