import { Prose, Section } from '@/components/site/article';
import { PostShell } from '@/components/site/post';
import { getPost, postMetadata } from '@/lib/blog';

const post = getPost('verification-call');

export const metadata = postMetadata(post);

export default function Page() {
  return (
    <PostShell post={post}>
      <Section n="01" title="A reminder service sells a failure mode">
        <Prose>
          Nobody signs up for wake-up calls because things are going well. You sign up for the one morning
          where the notification would have been swiped, the alarm would have been slept through, and the
          meeting was the kind you color red. The product is a promise about that specific morning, so
          delivery cannot be a claim on a marketing page. It has to be demonstrated.
        </Prose>
        <Prose>
          And the part that decides whether we can reach you is configuration we cannot see or set: our number
          saved as a contact, Emergency Bypass on iOS or a starred contact on Android. If any of it is wrong,
          every future call fails silently, on the morning it mattered.
        </Prose>
      </Section>

      <Section n="02" title="So the proof is the last onboarding step">
        <Prose>
          After you connect your calendar and add your number, we place a test call while your Do Not Disturb
          is switched on. It says:{' '}
          <em>
            Wake up babe, it works. This is your verification call. Press 1 to prove you heard me through Do
            Not Disturb.
          </em>{' '}
          Press 1 and the account goes live. Until then we schedule nothing, because we cannot honestly claim
          we would reach you.
        </Prose>
        <Prose>
          The verification call is free and does not count against the five calls a month on the free plan. If
          it does not ring, the dashboard walks you through what to fix, and you try again.
        </Prose>
      </Section>

      <Section n="03" title="The drop-off we accepted">
        <Prose>
          A signup flow that ends in a phone call has more friction than one that ends at a dashboard, and
          some people will leave at that step. The alternative was activating accounts that look fine and
          silently cannot ring, and then finding out together, after the board review. On that morning the
          missed call is not a user who misconfigured Do Not Disturb. It is the product not working.
        </Prose>
        <Prose>
          We would rather lose the signup than take that trade. If you want to see the whole path before
          starting, <a href="/do-not-disturb-meeting-reminders/">the Do Not Disturb guide</a> walks through
          it.
        </Prose>
      </Section>
    </PostShell>
  );
}
