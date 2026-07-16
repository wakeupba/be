import type { LucideIcon } from 'lucide-react';
import { BellRing, History, Lock, PhoneForwarded } from 'lucide-react';

interface Feature {
  icon: LucideIcon;
  title: string;
  body: string;
}

const FEATURES: Feature[] = [
  {
    icon: BellRing,
    title: 'Rings through Do Not Disturb',
    body: 'Setup ends with a proof: you turn DND on, we call, you answer. If the test does not ring, you are not activated. No wishful thinking.',
  },
  {
    icon: Lock,
    title: 'Read-only by design',
    body: 'The Google permission we request cannot write events, send email, or touch anything. The scope is the privacy policy.',
  },
  {
    icon: PhoneForwarded,
    title: 'One keypress, handled',
    body: 'Press 1 and we log the acknowledgment. Press 2 and we call again in 5 minutes. Miss the call and we retry once, which is exactly what pierces DND.',
  },
  {
    icon: History,
    title: 'Every call accounted for',
    body: 'The dashboard shows what we detected, when we will ring, and how every past call ended. If something did not ring, you can see why.',
  },
];

export function Features() {
  return (
    <section className="border-b border-line-soft">
      <div className="mx-auto max-w-5xl border-x border-line-soft px-6 py-16 sm:py-20">
        <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-muted-2">
          Built for reliability
        </p>
        <h2 className="mt-3 max-w-md text-2xl font-semibold tracking-tight sm:text-3xl">
          A reminder is only as good as its worst day.
        </h2>
        <div className="mt-10 grid gap-px overflow-hidden rounded-card border border-line-soft bg-line-soft sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="bg-background p-6">
              <feature.icon className="size-4 text-muted-2" aria-hidden />
              <h3 className="mt-3 text-[15px] font-semibold">{feature.title}</h3>
              <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-muted">{feature.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
