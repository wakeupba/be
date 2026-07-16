import { Reveal } from '@/components/motion/reveal';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const FAQS = [
  {
    question: 'How does it ring through Do Not Disturb?',
    answer:
      'During setup you save our number as a contact and allow it through DND: Emergency Bypass on iOS, starred contact on Android. Then we place a test call while your DND is on. You only go live once that call actually rings. If a call is ever missed anyway, we retry once within minutes, which both platforms let through as a repeated call.',
  },
  {
    question: 'What can you see in my calendar?',
    answer:
      'We request the read-only Google Calendar scope. We can see event titles, times, colors and attendee counts, and we cannot create, edit, delete or respond to anything. Pressing 1 on a call is logged in your dashboard only, nothing is written back to your calendar.',
  },
  {
    question: 'What happens if I do not answer?',
    answer:
      'We call once more about 2 minutes later. If the second call is missed too, the event is marked missed in your dashboard so you can see it the moment you look at your phone.',
  },
  {
    question: 'Which calendars are supported?',
    answer:
      'Google Calendar at launch, primary calendar first. Outlook is on the roadmap and gets built when enough people vote for it on the dashboard.',
  },
  {
    question: 'What happens when I run out of calls?',
    answer:
      'Nothing surprising. We stop calling, you see it in the dashboard and get an email. You can top up with a $2 pack of 50 calls or upgrade. There is no metered billing and no invoice you did not expect.',
  },
  {
    question: 'Can I self-host it?',
    answer:
      'Yes. The entire product is AGPL-3.0 on GitHub. You will need your own Google OAuth app, a telephony account and a phone number. The hosted version exists so you do not have to maintain any of that.',
  },
];

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
