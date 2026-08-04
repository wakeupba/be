import { BreadcrumbJsonLd, WebPageJsonLd } from '@/components/seo/json-ld';
import { ArticleShell, Prose, Section } from '@/components/site/article';
import { Cta } from '@/components/site/cta';
import { Footer } from '@/components/site/footer';
import { Header } from '@/components/site/header';
import { pageMetadata } from '@/lib/seo';

const PATH = '/do-not-disturb-meeting-reminders/';
const TITLE = 'Meeting reminders that ring through Do Not Disturb';
const DESCRIPTION =
  'Do Not Disturb silences calendar notifications by design. How Emergency Bypass on iOS, starred contacts on Android, and repeated calls get one reminder through anyway.';
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
          title="Meeting reminders that ring through Do Not Disturb"
          lede="Do Not Disturb is working correctly when it swallows your calendar notification. The fix is not a louder notification, it is a different channel, and both mobile platforms already have a door for it."
          updated={UPDATED}
        >
          <Section n="01" title="Why your reminder never arrived">
            <Prose>
              Do Not Disturb, Focus modes and sleep schedules all do the same thing to app notifications: hold
              them silently until you look. A calendar reminder is an app notification. It obeyed the rule you
              set. The reminder was not lost, it was queued, and you read it after the meeting started.
            </Prose>
            <Prose>
              This is worth being precise about, because the instinct is to blame the calendar app and go
              looking for a louder setting. There isn&rsquo;t one. Every app notification is subject to the
              same gate, so no calendar app can win this from inside the notification system.
            </Prose>
          </Section>

          <Section n="02" title="The door both platforms leave open">
            <Prose>
              Phone calls are treated differently from notifications, because both Apple and Google assume a
              ringing phone might be an emergency. Neither platform lets an arbitrary app ring you, but both
              let a <strong>specific contact</strong> ring you, and both treat a{' '}
              <strong>repeated call from the same number</strong> as a signal that something is urgent.
            </Prose>
            <Prose>
              That is the whole mechanism. A reminder delivered as a call from a contact you have allowed
              arrives while notifications from the same event are still queued.
            </Prose>
          </Section>

          <Section n="03" title="iOS: Emergency Bypass">
            <Prose>
              iOS has a per-contact setting that overrides Do Not Disturb and the ringer switch entirely. Save
              the number as a contact first, then:
            </Prose>
            <ul>
              <li>Open the contact and tap Edit.</li>
              <li>Tap Ringtone, then turn on Emergency Bypass. Do the same under Text Tone if you want.</li>
              <li>Tap Done.</li>
            </ul>
            <Prose>
              Emergency Bypass beats Do Not Disturb and every Focus mode without you having to add the contact
              to each Focus separately. The alternative, adding the contact to an individual Focus
              mode&rsquo;s allowed-people list, only covers that one mode, which is the usual reason a setup
              that worked on Tuesday fails during a Sleep schedule on Wednesday.
            </Prose>
            <Prose>
              iOS also has an <strong>Allow Repeated Calls</strong> option in Focus settings. With it on, a
              second call from the same number within three minutes rings through even without Emergency
              Bypass.
            </Prose>
          </Section>

          <Section n="04" title="Android: starred contacts and priority mode">
            <Prose>
              Android handles this through priority exceptions rather than a per-contact switch. The wording
              varies by manufacturer, but the shape is consistent:
            </Prose>
            <ul>
              <li>Save the number as a contact, then star it, which marks it a favourite.</li>
              <li>Open Settings, then Notifications, then Do Not Disturb, and find People or Calls.</li>
              <li>Set calls to be allowed from Starred contacts or Favourites.</li>
              <li>
                While you are there, enable Allow repeat callers, which lets a second call from the same
                number within fifteen minutes through.
              </li>
            </ul>
            <Prose>
              Samsung, Pixel and OnePlus each move these menus around, so search your settings for Do Not
              Disturb if the path above does not match. The setting you want always exists.
            </Prose>
          </Section>

          <Section n="05" title="Test it before you trust it">
            <Prose>
              This is the step nearly everyone skips. Do Not Disturb configuration is invisible until it
              fails, and it fails silently at exactly the moment it mattered. Turn Do Not Disturb on, have
              someone call you from that number, and confirm the phone actually rings.
            </Prose>
            <Prose>
              Wake Up Babe makes that mandatory rather than optional. Setup ends with a verification call
              placed while your Do Not Disturb is on, and the account does not activate until the call rings
              and you press 1. If your configuration is wrong, you find out during onboarding instead of
              during a board review. When a real reminder is missed anyway, we place one more call two minutes
              later, which is the repeat-caller pattern both platforms already allow.
            </Prose>
          </Section>

          <Section n="06" title="Doing it without us">
            <Prose>
              Everything in sections 03 and 04 is a platform feature, not a product feature, and it works for
              any number you care about: your partner, your on-call rotation, your kid&rsquo;s school. If all
              you needed was the Emergency Bypass instructions, take them and go.
            </Prose>
            <Prose>
              What we add is the other half: something that decides when to call you. Colour a Google Calendar
              event red and the call happens automatically before it starts, with a briefing read from the
              event and a keypress to acknowledge. Five calls a month are free, and the code is AGPL-3.0 if
              you would rather run it yourself.
            </Prose>
          </Section>
        </ArticleShell>
        <Cta />
      </main>
      <Footer />
    </>
  );
}
