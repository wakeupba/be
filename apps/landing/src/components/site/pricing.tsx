import { Check } from 'lucide-react';
import { Reveal } from '@/components/motion/reveal';
import { ButtonLink } from '@/components/ui/button';
import { PLANS } from '@/lib/content';
import { APP_URL } from '@/lib/site';

/*
 * On the homepage this is a section under the hero, so it introduces itself with
 * the eyebrow and an h2.
 *
 * On /pricing/ the page's own h1 already says this, and two display headings
 * stacked is one heading too many. Pass `heading={null}` there: the block is
 * dropped and the plan cards move up under the h1 where they belong.
 */
export function Pricing({ heading }: { heading?: string | null } = {}) {
  /* The plan names sit one level under whatever heading is above them. With the
   * section heading present that is an h3; with it dropped on /pricing/ the h1 is
   * the parent, so they move to h2 rather than leaving a gap in the outline.
   * Same classes either way, so this changes the document and not the design. */
  const PlanName = heading === null ? 'h2' : 'h3';

  return (
    <section id="pricing">
      <div
        className={
          heading === null
            ? 'mx-auto max-w-6xl px-6 pb-24 pt-14 sm:pb-32'
            : 'mx-auto max-w-6xl px-6 py-24 sm:py-32'
        }
      >
        {heading !== null && (
          <Reveal className="mx-auto max-w-xl text-center">
            <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-muted-2">Pricing</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              {heading ?? 'One missed meeting costs more than a year of this.'}
            </h2>
          </Reveal>
        )}
        <div
          className={
            heading === null
              ? 'mx-auto grid max-w-3xl gap-5 sm:grid-cols-2'
              : 'mx-auto mt-16 grid max-w-3xl gap-5 sm:grid-cols-2'
          }
        >
          {PLANS.map((plan) => (
            <div key={plan.name} className="flex flex-col rounded-2xl border border-line bg-background p-7">
              <div className="flex items-baseline justify-between">
                <PlanName className="text-[15px] font-semibold">{plan.name}</PlanName>
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
        {/* Prices are tax-exclusive at the processor, so this line is what keeps
         * "no invoice you did not expect" true: the tax is named here and
         * itemised at checkout before a card is entered. Muted mono, one line,
         * because it is a fact and not a paragraph of legal. */}
        <p className="mt-6 text-center font-mono text-[12px] text-muted-2">
          plus tax where your country charges it, shown at checkout
        </p>
      </div>
    </section>
  );
}
