import { FaqJsonLd, SoftwareJsonLd } from '@/components/seo/json-ld';
import { Cta } from '@/components/site/cta';
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
        <Features />
        <Pricing />
        <Faq />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
