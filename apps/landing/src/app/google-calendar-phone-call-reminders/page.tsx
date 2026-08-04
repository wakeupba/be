import { BreadcrumbJsonLd, WebPageJsonLd } from '@/components/seo/json-ld';
import { ArticleShell, Prose, Section } from '@/components/site/article';
import { Cta } from '@/components/site/cta';
import { Footer } from '@/components/site/footer';
import { Header } from '@/components/site/header';
import { pageMetadata } from '@/lib/seo';

const PATH = '/google-calendar-phone-call-reminders/';
const TITLE = 'Google Calendar phone call reminders';
const DESCRIPTION =
  'How to get an actual phone call before a Google Calendar event instead of a notification you will swipe away. Colour the event, answer the phone, press 1.';
const UPDATED = '2026-08-04';

export const metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
  type: 'article',
});

export default function Page() {
  return (
    <>
      <WebPageJsonLd name={TITLE} description={DESCRIPTION} path={PATH} lastModified={UPDATED} />
      <BreadcrumbJsonLd name={TITLE} path={PATH} />
      <Header />
      <main>
        <ArticleShell
          eyebrow="Guide"
          title="Google Calendar phone call reminders"
          lede="Google Calendar can email you, or it can push a notification. Both arrive in the same stream you have trained yourself to dismiss. Here is how to make the important ones ring instead."
          updated={UPDATED}
        >
          <Section n="01" title="Why the built-in reminders stop working">
            <Prose>
              Google Calendar gives you two reminder channels: email and notification. Both were designed for
              a time when you got a handful of each per day. On a full corporate calendar they arrive dozens
              of times, they look identical whether the event is a coffee chat or a board review, and the
              muscle memory to dismiss them without reading is built within a week.
            </Prose>
            <Prose>
              Then there is Do Not Disturb. Focus mode, sleep schedule, a meeting-heavy afternoon with
              notifications silenced: the reminder for the one meeting that mattered gets held back with all
              the rest, and you see it afterwards.
            </Prose>
            <Prose>
              The channel is the problem, not the timing. Nobody has trained themselves to ignore a ringing
              phone.
            </Prose>
          </Section>

          <Section n="02" title="Using event colour as the trigger">
            <Prose>
              The awkward part of any escalated-reminder setup is telling it which events deserve escalation.
              Building a separate list means maintaining a separate list. Tagging titles with keywords means
              your calendar reads like a filing system to everyone you invite.
            </Prose>
            <Prose>
              Event colour is already there, already private to your view, and already something you can
              change in two clicks from the event. Wake Up Babe watches for one colour, Tomato red by default,
              and treats it as the instruction to call. You can point it at any of the eleven Google Calendar
              colours instead, if red already means something else in your system.
            </Prose>
            <Prose>
              Nothing about the event changes for anyone else. The colour is yours, the access is read-only,
              and there is no new interface to keep up to date.
            </Prose>
          </Section>

          <Section n="03" title="What the call actually does">
            <Prose>
              We poll your calendar every five minutes and schedule a call for your chosen lead time: 10, 15
              or 30 minutes before the event starts. When it rings, it reads a short briefing built from the
              event itself, then waits for a keypress.
            </Prose>
            <Prose>
              For a board review at 2:30 with six people invited, the call says:{' '}
              <em>
                Wake up babe. Quarterly board review starts in 15 minutes. 6 people are expected. Press 1 if
                you are on it. Press 2 and I will call again in 5 minutes.
              </em>
            </Prose>
            <ul>
              <li>
                <strong>Press 1.</strong> Acknowledged, logged in your dashboard, we leave you alone.
              </li>
              <li>
                <strong>Press 2.</strong> We hang up and call again in five minutes.
              </li>
              <li>
                <strong>No answer.</strong> We call once more, two minutes later. A repeated call from the
                same number is the specific pattern both iOS and Android let through Do Not Disturb.
              </li>
            </ul>
            <Prose>
              Calls come from one permanent number that you save as a contact during setup. That is what makes
              the Do Not Disturb exception possible, and it means the caller ID is recognisable at 7am.
            </Prose>
          </Section>

          <Section n="04" title="Setting it up">
            <Prose>
              Sign in with Google and grant read-only calendar access. Add your phone number, save our number
              as a contact, and allow it through Do Not Disturb. Then, with Do Not Disturb switched on, we
              place a verification call:{' '}
              <em>
                Wake up babe, it works. This is your verification call. Press 1 to prove you heard me through
                Do Not Disturb.
              </em>
            </Prose>
            <Prose>
              Your account does not go live until that call actually rings and you press 1. A reminder service
              that cannot demonstrate it reaches you is worth nothing, so the proof is part of onboarding
              rather than a claim on a marketing page. The verification call does not count against your
              allowance.
            </Prose>
          </Section>

          <Section n="05" title="What it deliberately cannot do">
            <Prose>
              The Google permission we request is <code>calendar.readonly</code>, and that is the entire
              access. We cannot create events, edit them, delete them, or RSVP on your behalf. Pressing 1 is
              recorded in your dashboard and written nowhere else. This is not a policy we could quietly
              change, it is the scope Google enforces.
            </Prose>
            <Prose>
              Current limits, plainly: Google Calendar only, with Outlook on the roadmap behind a vote on the
              dashboard. Calls reach United States numbers, with other regions on a waitlist. Events you
              colour minutes before they start may not survive the five-minute poll in time.
            </Prose>
          </Section>

          <Section n="06" title="What it costs">
            <Prose>
              Five calls a month, free, with every feature included. Fifty calls a month for $5 if your
              calendar is the job, with $2 top-up packs of 50. When you run out we stop calling and tell you,
              rather than billing you for overage. The whole thing is AGPL-3.0 open source, so you can also
              run your own copy and pay a telephony provider directly.
            </Prose>
          </Section>
        </ArticleShell>
        <Cta />
      </main>
      <Footer />
    </>
  );
}
