import { Prose, Section } from '@/components/site/article';
import { PostShell } from '@/components/site/post';
import { getPost, postMetadata } from '@/lib/blog';

const post = getPost('one-permanent-number');

export const metadata = postMetadata(post);

export default function Page() {
  return (
    <PostShell post={post}>
      <Section n="01" title="Nobody answers unknown numbers anymore">
        <Prose>
          A decade of robocalls trained everyone to treat an unrecognized ring as spam, the same way push
          abuse trained everyone to swipe banners without reading them. The platforms have automated the
          distrust: iOS will silence unknown callers entirely if you ask it to, and Android screens them. A
          wake-up call from a number you have never seen is spam with good intentions, and it gets handled
          like spam.
        </Prose>
        <Prose>
          So the first thing setup asks is that you save our number as a contact. At 7am the screen says Wake
          Up Babe, not ten digits you have to squint at.
        </Prose>
      </Section>

      <Section n="02" title="Every Do Not Disturb exception is contact-shaped">
        <Prose>
          The doors through Do Not Disturb are all attached to contacts. Emergency Bypass on iOS is a setting
          on a contact card. Starred contacts on Android are, literally, contacts. A rotating caller ID can
          never match the exception you configured, so a product built on a number pool would break at exactly
          the moment it exists for.
        </Prose>
        <Prose>
          The retry works the same way. If you miss a call, we call once more about two minutes later, and
          both platforms let that second call through Do Not Disturb specifically because it is the same
          number calling twice.
        </Prose>
      </Section>

      <Section n="03" title="One number is also the off switch">
        <Prose>
          A permanent number cuts both ways, deliberately. Block it and the product is fully, verifiably off.
          There is no pool to play whack-a-mole with and no surprise call from a fresh caller ID after you
          thought you had opted out. A product that rings you at 7am should be exactly this easy to shut up.
        </Prose>
        <Prose>
          The number gets saved, allowed through Do Not Disturb and then proven during onboarding, because
          your account does not activate until a real call rings through. That story is{' '}
          <a href="/blog/verification-call/">its own post</a>.
        </Prose>
      </Section>
    </PostShell>
  );
}
