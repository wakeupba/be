import { Check } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';

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
    <section id="pricing" className="border-b border-line-soft">
      <div className="mx-auto max-w-5xl border-x border-line-soft px-6 py-16 sm:py-20">
        <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-muted-2">Pricing</p>
        <h2 className="mt-3 max-w-md text-2xl font-semibold tracking-tight sm:text-3xl">
          One missed meeting costs more than a year of this.
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {PLANS.map((plan) => (
            <div key={plan.name} className="flex flex-col rounded-card border border-line bg-background p-6">
              <div className="flex items-baseline justify-between">
                <h3 className="text-[15px] font-semibold">{plan.name}</h3>
                <p className="font-mono text-[12px] text-muted-2">{plan.cadence}</p>
              </div>
              <p className="mt-4 text-4xl font-semibold tabular-nums tracking-tight">{plan.price}</p>
              <p className="mt-3 min-h-10 text-[14px] leading-relaxed text-muted">{plan.description}</p>
              <ul className="mt-5 flex flex-col gap-2.5 border-t border-line-soft pt-5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2.5 text-[14px] text-muted">
                    <Check className="size-3.5 shrink-0 text-foreground" aria-hidden />
                    {feature}
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex grow items-end">
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
        <p className="mt-4 font-mono text-[12px] text-muted-2">
          Prices in USD. Calls to US and Canada numbers at launch, more regions on the roadmap.
        </p>
      </div>
    </section>
  );
}
