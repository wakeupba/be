import { ButtonLink } from '@/components/ui/button';

const APP_URL = 'https://app.wakeupba.be';

/* The one palette inversion on the page: a night panel right before the
 * dawn footer. Dark is DND territory, which is exactly where we work. */
export function Cta() {
  return (
    <section>
      <div className="mx-auto max-w-6xl px-6 pb-8 pt-12">
        <div className="rounded-[2rem] bg-foreground px-6 py-20 text-center sm:py-24">
          <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-white/45">
            Even on do not disturb
          </p>
          <h2 className="mx-auto mt-4 max-w-md text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Your next important meeting is coming.
          </h2>
          <p className="mt-3 text-[15px] text-white/60">Color it red. We will do the rest.</p>
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
