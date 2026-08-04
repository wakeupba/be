import { TOPUP_PACK } from '@wakeupbabe/shared';

/* The copy that two places need to agree on: the visible page and the
 * structured data we hand Google. Google penalises FAQPage markup that does not
 * match on-page text, and the only reliable way to keep them identical is to
 * have one source. Edit the answer here and both move together.
 *
 * Pack numbers come from TOPUP_PACK rather than being typed out. They were typed
 * out first and were wrong: the marketing copy advertised 50 calls for $2 when
 * the product sells 20, which is 4c a call against a real 10c and would have made
 * the pack strictly better value than the subscription it is supposed to top up.
 * The figure also reaches Google through FAQPage structured data, so a stale
 * number is not just an on-page mistake. */
const PACK = `$${TOPUP_PACK.priceUsd} pack of ${TOPUP_PACK.calls} calls`;

export interface Faq {
  question: string;
  answer: string;
}

export const FAQS: Faq[] = [
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
    /* Top-ups are gated to an active paid plan in the api, so this cannot offer
     * a free user a pack: on Situationship the only route to more calls is the
     * upgrade. */
    answer: `Nothing surprising. We stop calling, you see it in the dashboard and get an email. On Ride or Die you can top up with a ${PACK}, up to ${TOPUP_PACK.maxPerPeriod} packs a billing period. On the free plan the way to get more is to upgrade, because packs are extra calls on a plan rather than an alternative to one. There is no metered billing and no invoice you did not expect.`,
  },
  {
    question: 'Can I self-host it?',
    answer:
      'Yes. The entire product is AGPL-3.0 on GitHub. You will need your own Google OAuth app, a telephony account and a phone number. The hosted version exists so you do not have to maintain any of that.',
  },
];

export interface Plan {
  name: string;
  price: string;
  /* the numeric price, for JSON-LD Offer — schema.org wants a bare number */
  priceValue: number;
  cadence: string;
  description: string;
  features: string[];
  cta: string;
  primary: boolean;
}

export const PLANS: Plan[] = [
  {
    name: 'Situationship',
    price: '$0',
    priceValue: 0,
    cadence: 'forever',
    description: 'For trying it on your next few important meetings.',
    features: ['5 calls a month', 'Every feature included', 'DND verification call', 'Full call history'],
    cta: 'Start free',
    primary: false,
  },
  {
    name: 'Ride or Die',
    price: '$5',
    priceValue: 5,
    cadence: 'per month',
    description: 'For people whose calendar is the job.',
    features: ['50 calls a month', `Top up anytime, ${PACK}`, 'Priority support', 'Cancel in one click'],
    cta: 'Get Ride or Die',
    primary: true,
  },
];
