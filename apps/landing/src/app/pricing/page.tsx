import type { Metadata } from 'next';
import { Cta } from '@/components/site/cta';
import { Footer } from '@/components/site/footer';
import { Header } from '@/components/site/header';
import { Pricing } from '@/components/site/pricing';

export const metadata: Metadata = {
  title: 'Pricing | Wake Up Babe',
  description:
    'Situationship is free with 5 calls a month. Ride or Die is $5 a month for 50 calls. Top up anytime, cancel in one click, no surprises.',
};

export default function PricingPage() {
  return (
    <>
      <Header />
      <main>
        <Pricing />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
