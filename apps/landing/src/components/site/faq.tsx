import { Reveal } from '@/components/motion/reveal';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { FAQS } from '@/lib/content';

export function Faq() {
  return (
    <section id="faq">
      <div className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
        <div className="mx-auto grid max-w-4xl gap-12 lg:grid-cols-[1fr_1.6fr]">
          <Reveal>
            <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-muted-2">FAQ</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight">The questions worth asking.</h2>
          </Reveal>
          <Accordion type="single" collapsible>
            {FAQS.map((faq) => (
              <AccordionItem key={faq.question} value={faq.question} className="border-line">
                <AccordionTrigger>{faq.question}</AccordionTrigger>
                <AccordionContent>{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
