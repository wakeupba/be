import type { ReactNode } from 'react';
import { Reveal } from '@/components/motion/reveal';
import { ColorPickerArt, IphoneCallArt, MessyWeekArt } from './step-art';

interface Step {
  number: string;
  title: string;
  body: string;
  art: ReactNode;
}

const STEPS: Step[] = [
  {
    number: '01',
    title: 'Connect your calendar',
    body: 'Sign in with Google. We ask for read-only access, so we can see events but never touch them.',
    art: <MessyWeekArt />,
  },
  {
    number: '02',
    title: 'Color the meetings that matter',
    body: 'Mark any event red in Google Calendar, the same way you already color things. That is the whole workflow.',
    art: <ColorPickerArt />,
  },
  {
    number: '03',
    title: 'Answer the call',
    body: 'Your phone rings before the meeting with a short briefing. Press 1 to acknowledge, press 2 and we call again in 5 minutes.',
    art: <IphoneCallArt />,
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
        <div className="mx-auto mt-16 grid max-w-5xl gap-5 lg:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.number} className="overflow-hidden rounded-2xl border border-line bg-background">
              {step.art}
              <div className="p-6">
                <p className="font-mono text-[12px] tabular-nums text-muted-2">{step.number}</p>
                <h3 className="mt-2 text-[16px] font-semibold">{step.title}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
