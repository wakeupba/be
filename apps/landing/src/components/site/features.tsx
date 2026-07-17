import type { LucideIcon } from 'lucide-react';
import { BellRing, History, Lock, PhoneForwarded } from 'lucide-react';
import { Reveal } from '@/components/motion/reveal';

interface Feature {
  icon: LucideIcon;
  title: string;
  body: string;
}

const FEATURES: Feature[] = [
  {
    icon: BellRing,
    title: 'Rings through Do Not Disturb.',
    body: 'Setup ends with a proof: you turn DND on, we call, you answer. If the test does not ring, you are not activated. No wishful thinking.',
  },
  {
    icon: Lock,
    title: 'We watch. We do not touch.',
    body: 'The Google permission we request cannot write events, send email, or touch anything. The scope is the privacy policy.',
  },
  {
    icon: PhoneForwarded,
    title: 'One keypress, handled.',
    body: 'Press 1 and we log the acknowledgment. Press 2 and we call again in 5 minutes. Miss the call and we retry once, which is exactly what pierces DND.',
  },
  {
    icon: History,
    title: 'Receipts for every call.',
    body: 'The dashboard shows what we detected, when we will ring, and how every past call ended. If something did not ring, you can see why.',
  },
];

export function Features() {
  return (
    <section className="bg-paper">
      <div className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
        <Reveal className="mx-auto max-w-xl text-center">
          <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-muted-2">
            Built for reliability
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            A reminder is only as good as its worst day.
          </h2>
        </Reveal>
        <div className="mx-auto mt-16 grid max-w-4xl gap-5 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="rounded-2xl border border-line-soft bg-background p-7">
              <feature.icon className="size-[18px] text-muted-2" aria-hidden strokeWidth={1.8} />
              <h3 className="mt-4 text-[16px] font-semibold">{feature.title}</h3>
              <p className="mt-2.5 max-w-sm text-[14.5px] leading-relaxed text-muted">{feature.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
