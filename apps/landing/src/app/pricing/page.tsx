import { BreadcrumbJsonLd, SoftwareJsonLd } from '@/components/seo/json-ld';
import { Cta } from '@/components/site/cta';
import { Footer } from '@/components/site/footer';
import { Header } from '@/components/site/header';
import { Pricing } from '@/components/site/pricing';
import { OG_CARDS, pageMetadata } from '@/lib/seo';

const TITLE = 'Pricing';
const DESCRIPTION =
  'Situationship is free with 5 calls a month. Ride or Die is $5 a month for 50 calls. Top up anytime, cancel in one click, no surprises.';

export const metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: '/pricing/',
  card: OG_CARDS.pricing,
  imageAlt: 'Five free. Fifty for $5. No metered billing, no surprise invoice.',
});

export default function PricingPage() {
  return (
    <>
      <SoftwareJsonLd />
      <BreadcrumbJsonLd name={TITLE} path="/pricing/" />
      <Header />
      <main>
        {/* the page's own h1. The Pricing section only ever carries an h2, so
         * without this the document started at heading level two. */}
        <div className="mx-auto max-w-6xl px-6 pt-20 text-center sm:pt-28">
          <h1 className="mx-auto max-w-2xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
            Cheaper than the meeting you slept through.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted">
            Five calls a month, free, forever. Fifty for the price of a coffee. No metered billing, no invoice
            you did not expect, cancel in one click.
          </p>
        </div>
        <Pricing heading={null} />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
