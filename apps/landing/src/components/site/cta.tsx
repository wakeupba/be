import { ButtonLink } from '@/components/ui/button';

import { APP_URL } from '@/lib/site';

/* The one palette inversion on the page, right before the dawn footer. It
 * rides --foreground/--background rather than pinned black and white, so it
 * stays an inversion in either theme: a night panel on the light page, a
 * daylight panel on the dark one. */
export function Cta() {
  return (
    <section>
      <div className="mx-auto max-w-6xl px-6 pb-24 pt-16 sm:pb-32">
        <div className="rounded-[2rem] bg-foreground px-6 py-20 text-center sm:py-24">
          <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-background/50">
            Even on do not disturb
          </p>
          <h2 className="mx-auto mt-4 max-w-xl text-3xl font-semibold tracking-tight text-background sm:text-4xl">
            You are going to forget something.
            <br />
            We will call first.
          </h2>
          <p className="mt-3 text-[15px] text-background/65">Color it red. We will do the rest.</p>
          <div className="mt-8 flex justify-center">
            <ButtonLink href={APP_URL} variant="secondary" size="lg">
              Start free
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
