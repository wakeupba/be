import { Prose, Section } from '@/components/site/article';
import { PostShell } from '@/components/site/post';
import { getPost, postMetadata } from '@/lib/blog';

const post = getPost('calendar-color-picker-api');

export const metadata = postMetadata(post);

export default function Page() {
  return (
    <PostShell post={post}>
      <Section n="01" title="Marking events should not create a second system">
        <Prose>
          A tool that treats some meetings as more important than the rest needs you to mark them somehow, and
          the obvious designs all create a parallel system. A curated list in our dashboard means maintaining
          your calendar twice. Keywords in the title, something like <code>[CALL] board review</code>, turn
          your event names into config files that every invitee gets to read. A browser extension only exists
          in browsers, and calendars mostly get checked on phones.
        </Prose>
        <Prose>
          The marking also happens at the wrong moment. You decide a meeting is unmissable while you are
          looking at it in your calendar, not while you are in our app. Whatever the mechanism is, it has to
          be reachable from the event itself.
        </Prose>
      </Section>

      <Section n="02" title="The color picker was already the right interface">
        <Prose>
          Google Calendar lets you recolor any event in two clicks, on every surface it ships: web, iOS,
          Android. The color is private to your view, so nothing changes for the people you invited. There are
          eleven fixed values, and the API reports them on every event through the same read-only scope we
          already use to see your schedule.
        </Prose>
        <Prose>
          So that is the entire product interface. Wake Up Babe watches for one color, Tomato red by default,
          and treats it as an instruction to call your phone before the event. If red already means something
          in your color system, point it at any of the other ten. Nothing to install, nothing to curate, and
          Google maintains the interface for us.
        </Prose>
      </Section>

      <Section n="03" title="What a color cannot do">
        <Prose>
          A color carries no parameters. There is no way to encode a per-event lead time in it, which is why
          the 10, 15 or 30 minute lead is an account setting instead of something you write into the event.
        </Prose>
        <Prose>
          It is also not instant. We poll your calendar every five minutes, so an event you color moments
          before it starts may not make it into a call. And you do spend one of Google's eleven colors on us,
          which is a real cost if your calendar already assigns meaning to all eleven.
        </Prose>
        <Prose>
          Those trade-offs bought an interface nobody has to learn. The mechanics of the call itself, the
          briefing, the keypress, the retry, are all in{' '}
          <a href="/google-calendar-phone-call-reminders/">the setup guide</a>.
        </Prose>
      </Section>
    </PostShell>
  );
}
