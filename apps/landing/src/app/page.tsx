import { FaqJsonLd, SoftwareJsonLd } from '@/components/seo/json-ld';
import { Cta } from '@/components/site/cta';
import { DemoCall } from '@/components/site/demo-call';
import { Faq } from '@/components/site/faq';
import { Features } from '@/components/site/features';
import { Footer } from '@/components/site/footer';
import { Header } from '@/components/site/header';
import { Hero } from '@/components/site/hero';
import { HowItWorks } from '@/components/site/how-it-works';
import { Pricing } from '@/components/site/pricing';

export default function LandingPage() {
  return (
    <>
      <SoftwareJsonLd />
      <FaqJsonLd />
      <Header />
      <main>
        <Hero />
        <HowItWorks />
        {/* placed after the explanation, not next to the hero: the hero already
            carries the primary CTA, and this lands harder once someone knows
            what the call is for */}
        <DemoCall />
        <Features />
        <Pricing />
        <Faq />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
