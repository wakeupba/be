import { describe, expect, it } from 'vitest';
import {
  calendarBrokenEmail,
  missedCallEmail,
  numberUnverifiedEmail,
  outOfCallsEmail,
  type RenderedEmail,
} from '../src/services/email/templates';

const APP = 'https://app.wakeupba.be';
const TZ = 'Asia/Kolkata';
// fixed instant so snapshots never drift: 2026-08-04 09:15 IST
const STARTS_AT = Date.UTC(2026, 7, 4, 3, 45);

const ALL: Array<[string, RenderedEmail]> = [
  [
    'missed call, no answer',
    missedCallEmail({
      eventTitle: 'Quarterly review',
      startsAt: STARTS_AT,
      timezone: TZ,
      reason: 'no_answer',
      appOrigin: APP,
    }),
  ],
  [
    'missed call, out of calls',
    missedCallEmail({
      eventTitle: 'Quarterly review',
      startsAt: STARTS_AT,
      timezone: TZ,
      reason: 'out_of_calls',
      appOrigin: APP,
    }),
  ],
  [
    'out of calls',
    outOfCallsEmail({
      upcoming: [
        { id: 'evt_1', title: 'Board meeting', startsAt: STARTS_AT },
        { id: 'evt_2', title: 'One on one', startsAt: STARTS_AT + 86_400_000 },
      ],
      timezone: TZ,
      appOrigin: APP,
    }),
  ],
  ['number unverified', numberUnverifiedEmail({ appOrigin: APP })],
  ['calendar broken', calendarBrokenEmail({ appOrigin: APP })],
];

const FOOTER_PREFIX = 'Wake Up Babe ·';

/** everything except the brand line in the footer */
function bodyOnly(email: RenderedEmail): string {
  return `${email.subject}\n${email.text.split(FOOTER_PREFIX)[0]}`;
}

describe('email templates', () => {
  it.each(ALL)('%s renders stable copy', (_name, email) => {
    expect({ subject: email.subject, text: email.text }).toMatchSnapshot();
  });

  it.each(ALL)('%s renders stable html', (_name, email) => {
    expect(email.html).toMatchSnapshot();
  });

  /*
   * The voice guard. These are failure notices sent to someone's work inbox:
   * pet names read badly when forwarded and look promotional to spam
   * classifiers. Enforced structurally so it cannot regress by accident.
   */
  it.each(ALL)('%s keeps the notification voice', (_name, email) => {
    const body = bodyOnly(email);
    expect(body).not.toMatch(/babe/i);
    expect(body).not.toMatch(/[—–]/);
    expect(body).not.toMatch(/!/);
    // the footer is the only place the brand name appears
    expect(email.text).toContain(FOOTER_PREFIX);
  });

  it.each(ALL)('%s ships both parts with no images, buttons or tracking', (_name, email) => {
    expect(email.text.length).toBeGreaterThan(40);
    expect(email.html).toContain('<div');
    expect(email.html).not.toMatch(/<img/i);
    expect(email.html).not.toMatch(/<button/i);
    expect(email.html).not.toMatch(/background-color/i);
  });

  it('escapes calendar titles instead of trusting them', () => {
    const email = missedCallEmail({
      eventTitle: '<script>alert("xss")</script> & "review"',
      startsAt: STARTS_AT,
      timezone: TZ,
      reason: 'no_answer',
      appOrigin: APP,
    });
    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;');
    expect(email.html).toContain('&amp;');
    // the plain text part is not markup, so it keeps the raw title
    expect(email.text).toContain('<script>');
  });

  it('falls back to an iso timestamp on a bad timezone', () => {
    const email = missedCallEmail({
      eventTitle: 'Standup',
      startsAt: STARTS_AT,
      timezone: 'Not/AZone',
      reason: 'failed',
      appOrigin: APP,
    });
    expect(email.text).toContain('2026-08-04T03:45:00.000Z');
  });

  it('caps the meeting list at five', () => {
    const email = outOfCallsEmail({
      upcoming: Array.from({ length: 9 }, (_, n) => ({
        id: `evt_${n}`,
        title: `Meeting ${n}`,
        startsAt: STARTS_AT + n * 3_600_000,
      })),
      timezone: TZ,
      appOrigin: APP,
    });
    expect(email.text).toContain('Meeting 4');
    expect(email.text).not.toContain('Meeting 5');
  });
});
