import { Check } from 'lucide-react';
import { Reveal } from '@/components/motion/reveal';
import { ButtonLink } from '@/components/ui/button';
import { Waitlist } from './waitlist';

const APP_URL = 'https://app.wakeupba.be';

interface Plan {
  name: string;
  price: string;
  cadence: string;
  description: string;
  features: string[];
  cta: string;
  primary: boolean;
}

const PLANS: Plan[] = [
  {
    name: 'Situationship',
    price: '$0',
    cadence: 'forever',
    description: 'For trying it on your next few important meetings.',
    features: ['5 calls a month', 'Every feature included', 'DND verification call', 'Full call history'],
    cta: 'Start free',
    primary: false,
  },
  {
    name: 'Ride or Die',
    price: '$5',
    cadence: 'per month',
    description: 'For people whose calendar is the job.',
    features: [
      '50 calls a month',
      'Top up anytime, $2 per 50 extra',
      'Priority support',
      'Cancel in one click',
    ],
    cta: 'Get Ride or Die',
    primary: true,
  },
];

export function Pricing() {
  return (
    <section id="pricing">
      <div className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
        <Reveal className="mx-auto max-w-xl text-center">
          <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-muted-2">Pricing</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            One missed meeting costs more than a year of this.
          </h2>
        </Reveal>
        <div className="mx-auto mt-16 grid max-w-3xl gap-5 sm:grid-cols-2">
          {PLANS.map((plan) => (
            <div key={plan.name} className="flex flex-col rounded-2xl border border-line bg-background p-7">
              <div className="flex items-baseline justify-between">
                <h3 className="text-[15px] font-semibold">{plan.name}</h3>
                <p className="font-mono text-[12px] text-muted-2">{plan.cadence}</p>
              </div>
              <p className="mt-5 text-4xl font-semibold tabular-nums tracking-tight">{plan.price}</p>
              <p className="mt-3 min-h-10 text-[14px] leading-relaxed text-muted">{plan.description}</p>
              <ul className="mt-6 flex flex-col gap-3 border-t border-line-soft pt-6">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2.5 text-[14px] text-muted">
                    <Check className="size-3.5 shrink-0 text-foreground" aria-hidden />
                    {feature}
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex grow items-end">
                <ButtonLink
                  href={APP_URL}
                  variant={plan.primary ? 'primary' : 'secondary'}
                  className="w-full"
                >
                  {plan.cta}
                </ButtonLink>
              </div>
            </div>
          ))}
        </div>
        <div className="mx-auto max-w-3xl">
          <Waitlist />
        </div>
      </div>
    </section>
  );
}
