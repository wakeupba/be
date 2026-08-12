import { Prose, Section } from '@/components/site/article';
import { PostShell } from '@/components/site/post';
import { getPost, postMetadata } from '@/lib/blog';

const post = getPost('notification-fatigue');

export const metadata = postMetadata(post);

export default function Page() {
  return (
    <PostShell post={post}>
      <Section n="01" title="Dismissal is a skill you practiced">
        <Prose>
          Everything on your phone announces itself through the same channel. A message from your boss, a food
          delivery update and a 20% off push from an airline all arrive as the same banner with the same
          sound. Since most of them are safe to ignore, the rational response is to clear the stream without
          reading it, and you have practiced that response until it became a reflex.
        </Prose>
        <Prose>
          A calendar reminder is not exempt. It looks exactly like everything else, so it gets handled like
          everything else. The board review and the airline promo die by the same swipe.
        </Prose>
      </Section>

      <Section n="02" title="Louder is still the same channel">
        <Prose>
          The usual fix is volume: more reminders, an email plus a push, a second app that also sends
          notifications. It does not work, because the problem was never that you missed the notification. You
          saw it, categorized it as dismissable in under a second, and moved on. Sending more copies of a
          thing you ignore is extra practice at ignoring it.
        </Prose>
        <Prose>
          Do Not Disturb then finishes the job honestly. During focus time or sleep the reminder is not even
          seen. It is held back with the rest of the stream, exactly as you configured.
        </Prose>
      </Section>

      <Section n="03" title="One channel still carries a social contract">
        <Prose>
          A ringing phone is the last channel that demands a decision. It interrupts, it keeps going until you
          deal with it, and there is no muscle memory for batch-dismissing calls, because calls never came in
          batches. Answering is a commitment in a way a swipe never was.
        </Prose>
        <Prose>
          That contract survives only as long as the channel stays rare, which is why we ration it. Wake Up
          Babe rings for the events you explicitly color and for nothing else. If every calendar event rang
          your phone, you would learn to ignore phone calls too, and the last good channel would be gone.
        </Prose>
        <Prose>
          How we decide which events qualify is a two-click story, told in{' '}
          <a href="/blog/calendar-color-picker-api/">the color picker post</a>.
        </Prose>
      </Section>
    </PostShell>
  );
}
