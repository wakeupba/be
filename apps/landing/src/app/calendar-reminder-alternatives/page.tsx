import { BreadcrumbJsonLd, WebPageJsonLd } from '@/components/seo/json-ld';
import { ArticleShell, CompareTable, Prose, Section } from '@/components/site/article';
import { Cta } from '@/components/site/cta';
import { Footer } from '@/components/site/footer';
import { Header } from '@/components/site/header';
import { OG_CARDS, pageMetadata } from '@/lib/seo';

const PATH = '/calendar-reminder-alternatives/';
const TITLE = 'Calendar reminder options, compared honestly';
const DESCRIPTION =
  'Notifications, email, SMS, a second alarm, an assistant, or a phone call. What each reminder channel is actually good at, and which one survives Do Not Disturb.';
const UPDATED = '2026-08-04';

export const metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
  card: OG_CARDS.alternatives,
  imageAlt: 'Six ways. One rings. Notifications, email, SMS, alarms, assistants, calls.',
  type: 'article',
});

/* The first three columns stay one or two words on purpose: they are the
 * scannable answer, and the verdict column is where the nuance goes.
 *
 * Read the middle column as "work you must do for each event". The pattern the
 * page argues for only holds if these are honest: the automatic channels are the
 * silenced ones, the noisy channels are the manual ones, and a call is the only
 * row that is noisy and automatic at once. */
const ROWS = [
  {
    label: 'Push notification',
    cells: [
      'No',
      'None',
      'Free',
      'Fine for the twenty meetings a day you do not need reminding about. Useless for the one you do.',
    ],
  },
  {
    label: 'Email reminder',
    cells: [
      'No',
      'None',
      'Free',
      'Lands in the inbox you are already behind on. Good paper trail, bad alarm.',
    ],
  },
  {
    label: 'SMS reminder',
    cells: [
      'Usually not',
      'None',
      'Per message',
      'Feels more urgent than push, gets gated the same way. Needs a service to send it.',
    ],
  },
  {
    label: 'Second alarm',
    cells: [
      'Yes',
      'Every event',
      'Free',
      'Genuinely reliable, and entirely manual. You set one per event, which is the step you forget on a busy day, and it does not move when the meeting moves.',
    ],
  },
  {
    label: 'Smart speaker or assistant',
    cells: [
      'Not applicable',
      'Every event',
      'Free',
      'Loud and hands-free, but only if you are in the room with it. Nothing follows you.',
    ],
  },
  {
    label: 'Phone call',
    cells: [
      'Yes, once allowed',
      'None',
      'Free, then $5',
      'The only channel that both rings by default and can be triggered automatically from the calendar.',
    ],
  },
];

export default function Page() {
  return (
    <>
      <WebPageJsonLd name={TITLE} description={DESCRIPTION} path={PATH} lastModified={UPDATED} />
      <BreadcrumbJsonLd name={TITLE} path={PATH} />
      <Header />
      <main>
        <ArticleShell
          eyebrow="Comparison"
          title="Calendar reminder options, compared honestly"
          lede="Six ways to be reminded of a meeting, and the two questions that actually separate them: does it get through Do Not Disturb, and does it work without you remembering to set it up each time."
          updated={UPDATED}
        >
          <Section n="01" title="The two questions that matter">
            <Prose>
              Most comparisons of reminder tools argue about features. In practice a reminder either reaches
              you or it doesn&rsquo;t, and almost everything reduces to two properties.
            </Prose>
            <ul>
              <li>
                <strong>Does it survive Do Not Disturb?</strong> If the answer is no, the reminder is only as
                reliable as your willingness to leave notifications on, which for most people is not very.
              </li>
              <li>
                <strong>Does it fire without per-event work?</strong> A channel that requires you to set
                something up for each meeting fails on exactly the overloaded days when you needed it.
              </li>
            </ul>
            <Prose>
              Almost every option is strong on one and weak on the other. That is the whole story of the table
              below.
            </Prose>
          </Section>

          <Section n="02" title="The options">
            <CompareTable columns={['Through DND', 'Per-event work', 'Cost', 'Good for']} rows={ROWS} />
            <Prose className="mt-6">
              The pattern: everything free and automatic gets silenced, and everything that reliably makes
              noise needs you to arrange it one event at a time.
            </Prose>
          </Section>

          <Section n="03" title="When a notification is the right answer">
            <Prose>
              For the overwhelming majority of calendar events, it is. A standup you attend every day does not
              need escalation, and a channel that rings for all forty meetings this week is worse than no
              reminder at all, because you will mute it by Thursday.
            </Prose>
            <Prose>
              Escalation only works when it is rare. If you would escalate more than a few events a week, the
              problem to solve is the calendar, not the reminder.
            </Prose>
          </Section>

          <Section n="04" title="The case for a second alarm">
            <Prose>
              Worth saying plainly, because it is free and it works: for a genuinely unmissable event, set a
              clock alarm. Alarms are exempt from Do Not Disturb on every platform, they need no third party,
              and nothing can silently break them.
            </Prose>
            <Prose>
              Their weakness is that they are manual and dumb. You set them one at a time, they know nothing
              about the meeting, and they do not move when the meeting does. For anything that truly cannot be
              missed, a flight or a medical appointment, use one anyway, regardless of what else you have set
              up. We say the same thing in our <a href="/terms/">terms</a>.
            </Prose>
          </Section>

          <Section n="05" title="Where a call fits">
            <Prose>
              A phone call is the one channel that answers both questions at once. It rings by default, both
              platforms have a documented way to let a specific contact through Do Not Disturb, and it can be
              triggered automatically from calendar data with no per-event work from you.
            </Prose>
            <Prose>
              The catch is that it needs one piece of setup, once: saving the number and allowing it through.
              Our <a href="/do-not-disturb-meeting-reminders/">Do Not Disturb guide</a> covers the exact steps
              on iOS and Android, and they work for any number, ours or otherwise.
            </Prose>
            <Prose>
              Wake Up Babe is the automation half. Colour a Google Calendar event red and the phone rings
              before it, with a briefing read from the event and a keypress to acknowledge. Five calls a month
              are free, and the whole thing is{' '}
              <a href="/google-calendar-phone-call-reminders/">explained here</a>.
            </Prose>
          </Section>
        </ArticleShell>
        <Cta />
      </main>
      <Footer />
    </>
  );
}
