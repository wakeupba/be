import { Palette, PhoneIncoming } from 'lucide-react';
import { GoogleGIcon } from '@/components/brand/google';
import { Reveal } from '@/components/motion/reveal';

const STEPS = [
  {
    number: '01',
    icon: <GoogleGIcon className="size-4" />,
    title: 'Connect your calendar',
    body: 'Sign in with Google. We ask for read-only access, so we can see events but never touch them.',
  },
  {
    number: '02',
    icon: <Palette className="size-4 text-accent" aria-hidden />,
    title: 'Color the meetings that matter',
    body: 'Mark any event red in Google Calendar, the same way you already color things. That is the whole workflow.',
  },
  {
    number: '03',
    icon: <PhoneIncoming className="size-4 text-muted" aria-hidden />,
    title: 'Answer the call',
    body: 'Your phone rings before the meeting with a short briefing. Press 1 to acknowledge, press 2 and we call again in 5 minutes.',
  },
];

export function HowItWorks() {
  return (
    <section id="how">
      <div className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
        <Reveal className="mx-auto max-w-xl text-center">
          <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-muted-2">How it works</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            No new app to live in.
            <br />
            Your calendar is the interface.
          </h2>
        </Reveal>
        <div className="mx-auto mt-16 grid max-w-4xl gap-12 sm:grid-cols-3 sm:gap-10">
          {STEPS.map((step) => (
            <div key={step.number} className="text-center sm:text-left">
              <div className="mx-auto flex size-10 items-center justify-center rounded-xl border border-line bg-background sm:mx-0">
                {step.icon}
              </div>
              <p className="mt-5 font-mono text-[12px] tabular-nums text-muted-2">{step.number}</p>
              <h3 className="mt-2 text-[16px] font-semibold">{step.title}</h3>
              <p className="mt-2.5 text-[14.5px] leading-relaxed text-muted">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
