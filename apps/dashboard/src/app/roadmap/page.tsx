'use client';

import type { FeatureCardDto } from '@wakeupbabe/shared';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Panel, SectionHeader } from '@/components/ui/panel';
import { api } from '@/lib/api';
import { useMe } from '@/lib/use-me';
import { cn } from '@/lib/utils';

export default function RoadmapPage() {
  const { state } = useMe();
  const [features, setFeatures] = useState<FeatureCardDto[] | null>(null);

  useEffect(() => {
    if (state.status !== 'ready') return;
    api
      .features()
      .then(setFeatures)
      .catch(() => setFeatures([]));
  }, [state.status]);

  if (state.status !== 'ready') {
    return <AppShell me={null}>{null}</AppShell>;
  }

  async function toggleVote(key: string) {
    await api.voteFeature(key);
    const next = await api.features().catch(() => null);
    if (next) setFeatures(next);
  }

  return (
    <AppShell me={state.me} title="Roadmap">
      <div className="rise-in mx-auto w-full max-w-2xl py-2">
        <SectionHeader title="Coming soon" />
        <p className="mb-4 max-w-md text-[13px] leading-relaxed text-muted-foreground">
          Votes decide what gets built next. Press the button on anything you would use.
        </p>
        <div className="flex flex-col gap-3">
          {features === null ? (
            <Panel className="flex min-h-24 items-center justify-center">
              <p className="text-xs text-muted-foreground/70">Loading the board.</p>
            </Panel>
          ) : (
            features.map((feature) => (
              <Panel key={feature.key} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="text-[15px] font-semibold">{feature.title}</h2>
                    <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <Button
                      variant={feature.votedByMe ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => void toggleVote(feature.key)}
                    >
                      {feature.votedByMe ? 'Wanted' : 'I want this'}
                    </Button>
                    <p
                      className={cn(
                        'font-mono text-[11px] tabular-nums',
                        feature.votes > 0 ? 'text-muted-foreground' : 'text-muted-foreground/60',
                      )}
                    >
                      {feature.votes} {feature.votes === 1 ? 'vote' : 'votes'}
                    </p>
                  </div>
                </div>
              </Panel>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
