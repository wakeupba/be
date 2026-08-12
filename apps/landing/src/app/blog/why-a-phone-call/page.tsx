import { Prose, Section } from '@/components/site/article';
import { PostShell } from '@/components/site/post';
import { getPost, postMetadata } from '@/lib/blog';

const post = getPost('why-a-phone-call');

export const metadata = postMetadata(post);

export default function Page() {
  return (
    <PostShell post={post}>
      <Section n="01" title="Your brain is built to defeat alarms">
        <Prose>
          Habituation is the nervous system's oldest trick: a stimulus that repeats without consequence stops
          being perceived. It is why you do not hear your own refrigerator. The 6:30 alarm is the same tone at
          the same time every day, and after enough mornings your brain files it with the refrigerator. Plenty
          of people have woken up to a dismissed alarm with no memory of dismissing it, because the snooze tap
          happens below the level of decision-making.
        </Prose>
        <Prose>
          Hospitals have a name for this: alarm fatigue. Monitors beep so often that staff stop hearing them,
          and it is studied as a patient safety problem, not as a discipline problem. Nobody writes up a nurse
          for being human. Your relationship with your alarm app deserves the same honesty.
        </Prose>
        <Prose>
          An alarm is also empty. The same tone plays for the gym at six and the flight at nine, so the sound
          itself tells you nothing about what you are dismissing. Past you, who knew the stakes, set it.
          Future you, groggy and warm, decides what to do with it. Any gap between those two people is
          resolved in favor of the pillow.
        </Prose>
      </Section>

      <Section n="02" title="Notifications fail in the opposite direction">
        <Prose>
          Alarms die from repetition. Notifications die from crowding. A message from your boss, a food
          delivery update and a 20% off push from an airline all arrive as the same banner with the same
          sound, and since most of them are safe to ignore, you learned to triage the whole stream in under a
          second. The board review and the airline promo die by the same swipe.
        </Prose>
        <Prose>
          The usual fix is volume: more reminders, an email plus a push, a second app that also sends
          notifications. It does not work, because you did not miss the first notification. You saw it,
          categorized it as dismissable, and moved on. Sending more copies of a thing you ignore is extra
          practice at ignoring it.
        </Prose>
        <Prose>
          Then Do Not Disturb finishes the job honestly. During sleep or focus time the reminder is not even
          seen. It is held back with the rest of the stream, exactly as you configured, which is Do Not
          Disturb working correctly.
        </Prose>
      </Section>

      <Section n="03" title="The phone call is the channel your brain still respects">
        <Prose>
          A ringing phone is the last channel that demands a decision. It interrupts, it keeps going until you
          deal with it, and there is no muscle memory for batch-dismissing calls, because calls never came in
          batches. A ring also carries a social claim that no banner does: somewhere, someone wants you right
          now, synchronously. You can sleep through a chime. Sleeping through a phone that rings, stops, and
          rings again from a name you know is a much taller order, and the platforms designed it that way on
          purpose.
        </Prose>
        <Prose>
          Even after a decade of robocalls, a call from a saved contact gets answered close to automatically.
          The distrust people have built up is aimed at unknown numbers, which is exactly why{' '}
          <a href="/blog/one-permanent-number/">every Wake Up Babe call comes from one permanent number</a>{' '}
          that you save as a contact during setup. At 7am the screen says a name, not ten digits.
        </Prose>
      </Section>

      <Section n="04" title="Reminder systems die of friction, not of bad ideas">
        <Prose>
          Every reminder tool asks for labor before it gives any back. Install the app on your phone, and also
          on the tablet, and also on the laptop. Grant the permissions. Keep it updated. Maintain the list of
          things that matter inside it, forever, as a second calendar next to your real one. Each piece of
          upkeep is a place to lapse, and the tool quietly stops working the week you are too busy to maintain
          it, which is precisely the week it existed for.
        </Prose>
        <Prose>
          There is a contradiction at the bottom of that design: the product's entire job is to outsource your
          discipline, but the product itself runs on your discipline. A system that needs willpower to keep
          working cannot be the backup for your willpower.
        </Prose>
      </Section>

      <Section n="05" title="So the whole interface is a color you already have">
        <Prose>
          This is why there is no Wake Up Babe app, no browser extension and no second list. There is nothing
          to install anywhere. You mark a meeting by coloring it red in Google Calendar, in the exact moment
          you are already looking at it and thinking this one cannot be missed. Two clicks, in the tool you
          already live in, on every device Google already ships. Why the color picker, of all things, is{' '}
          <a href="/blog/calendar-color-picker-api/">its own story</a>.
        </Prose>
        <Prose>
          Everything after those two clicks is automated. We poll your calendar every five minutes through a
          read-only connection, schedule the call for your chosen lead time of 10, 15 or 30 minutes, build a
          short spoken briefing from the event itself, and ring you. Press 1 and you are done. Press 2 and we
          call again in five minutes. The recurring human input, the part that has to survive your worst week,
          is two clicks.
        </Prose>
      </Section>

      <Section n="06" title="How the call gets through Do Not Disturb">
        <Prose>
          Both platforms leave deliberate doors through Do Not Disturb, and both doors are shaped like a
          contact. On iOS, Emergency Bypass is a switch on a contact card that lets that contact ring through
          any Focus mode. On Android, a starred contact is allowed through Do Not Disturb's priority rules.
          During setup you save our number and flip that one switch, and from then on the call rings while
          everything else stays silenced.
        </Prose>
        <Prose>
          If you miss a call anyway, we call once more about two minutes later. Both platforms treat a
          repeated call from the same number as a signal of urgency and let it through, which is one more
          reason the number never changes.
        </Prose>
        <Prose>
          And because all of this lives in your phone's settings where we cannot see it, we do not take it on
          faith. Onboarding ends with a verification call placed while your Do Not Disturb is on, and{' '}
          <a href="/blog/verification-call/">your account does not go live until you press 1 on it</a>. The
          full walkthrough is in <a href="/do-not-disturb-meeting-reminders/">the Do Not Disturb guide</a>.
        </Prose>
      </Section>

      <Section n="07" title="Rare on purpose">
        <Prose>
          One caveat keeps the whole argument honest: the phone call only works because it is rare. The ring
          commands attention today for the same reason the notification no longer does, it has not been abused
          yet. If every calendar event rang your phone, you would build the same dismissal reflex for calls
          that you built for banners, and the last good channel would be gone.
        </Prose>
        <Prose>
          So we ration it. Wake Up Babe rings for the events you explicitly color and for nothing else. Most
          meetings deserve a notification. A few deserve a phone call, and you already know which ones,
          because your hand hesitates on them in the calendar. Color those red, and{' '}
          <a href="/google-calendar-phone-call-reminders/">the setup guide</a> takes it from there.
        </Prose>
      </Section>
    </PostShell>
  );
}
