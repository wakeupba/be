'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

const API = process.env.NEXT_PUBLIC_API_ORIGIN ?? '';

const REGIONS = ['Europe', 'United Kingdom', 'India', 'Australia', 'Other'] as const;

type Status = 'idle' | 'sending' | 'done' | 'error';

/*
 * Region waitlist: calls launch in US and Canada first, everyone else leaves
 * an email and gets notified when their region ships. Backed by POST /waitlist.
 */
export function Waitlist() {
  const [email, setEmail] = useState('');
  const [region, setRegion] = useState<(typeof REGIONS)[number]>('Europe');
  const [status, setStatus] = useState<Status>('idle');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setStatus('sending');
    try {
      const response = await fetch(`${API}/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, region }),
      });
      setStatus(response.ok ? 'done' : 'error');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'done') {
    return (
      <div className="mt-6 rounded-2xl border border-line-soft bg-background p-6">
        <p className="text-[15px] font-medium">You are on the list.</p>
        <p className="mt-1 font-mono text-[12px] text-muted-2">we will email you the day {region} ships</p>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-2xl border border-line-soft bg-background p-6">
      <div className="flex flex-col gap-1.5">
        <p className="text-[15px] font-medium">Outside the US and Canada?</p>
        <p className="text-[14px] text-muted">
          Calls start in North America. Join the waitlist and we will email you when your region goes live.
        </p>
      </div>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-2.5 sm:flex-row">
        <div className="relative">
          <select
            value={region}
            onChange={(event) => setRegion(event.target.value as (typeof REGIONS)[number])}
            className="h-9 w-full appearance-none rounded-lg border border-line bg-background pl-3 pr-9 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/40"
            aria-label="Your region"
          >
            {REGIONS.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-2"
            aria-hidden
          />
        </div>
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@company.com"
          className="h-9 grow rounded-lg border border-line bg-background px-3 text-sm placeholder:text-muted-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/40"
          aria-label="Email address"
        />
        <Button type="submit" disabled={status === 'sending'}>
          {status === 'sending' ? 'Joining' : 'Join waitlist'}
        </Button>
      </form>
      {status === 'error' && (
        <p className="mt-2.5 font-mono text-[12px] text-muted-2">
          that did not go through, try again in a moment
        </p>
      )}
    </div>
  );
}
