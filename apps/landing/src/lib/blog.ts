import type { Metadata } from 'next';
import { OG_CARDS, pageMetadata } from './seo';
import { X_URL } from './site';

/*
 * The blog registry. One entry per post, and everything else derives from it:
 * the index page, the sitemap, the JSON-LD and each post's metadata. Adding a
 * post is one folder under app/blog/ plus one entry here, newest first.
 *
 * Post bodies stay in their page.tsx as JSX rather than MDX. Four short posts
 * do not justify a content pipeline, and the explainer pages already write
 * prose this way.
 */

/* Posts carry a person's name and face, not "the Wake Up Babe team". The
 * avatar is the GitHub one, vendored into public/ so the page never leans on
 * a third-party host. */
export const AUTHOR = { name: 'Aditya Singhi', url: X_URL, avatar: '/authors/aditya.png' };

type OgCard = (typeof OG_CARDS)[keyof typeof OG_CARDS];

export interface BlogPost {
  slug: string;
  /* the h1 and the <title> */
  title: string;
  /* meta description, and the summary line on the index */
  description: string;
  /* the opening paragraph under the h1; longer and warmer than description */
  lede: string;
  /* the mono microlabel above the title: what kind of post this is */
  eyebrow: string;
  /* ISO date. Hand-maintained for the same reason ROUTES dates are: stamping
   * build time would tell Google every post changed on every deploy. */
  published: string;
  /* bump only when the copy meaningfully changes */
  updated?: string;
  readMinutes: number;
  card: OgCard;
  /* what the card actually says, not a description of the post */
  imageAlt: string;
}

export function postPath(slug: string): string {
  return `/blog/${slug}/`;
}

export const POSTS: BlogPost[] = [
  {
    slug: 'why-a-phone-call',
    title: 'Why a phone call and not another alarm app',
    description:
      'Alarms get habituated, notifications get triaged, reminder apps get abandoned. The long version of why this product is a phone call through Do Not Disturb, and why its only interface is a calendar color.',
    lede: 'Wake Up Babe could have been an app, an extension or a louder alarm. It is a phone call instead, and I did not arrive at that from first principles. My roommate discovered it for me, from the bed across the room.',
    eyebrow: 'Essay',
    published: '2026-08-12',
    readMinutes: 7,
    card: OG_CARDS.blogWhyCall,
    imageAlt: 'the alarm never had a chance. habituation. triage. the one channel left.',
  },
  {
    slug: 'calendar-color-picker-api',
    title: "We built the whole product on Google Calendar's color picker",
    description:
      'Every escalated-reminder tool needs a way to mark which events matter. We shipped the one Google already built: the event color picker.',
    lede: 'Every escalated-reminder tool has to answer one question: which events deserve the escalation? We evaluated keyword tags, curated lists and browser extensions, then shipped an interface Google finished years ago.',
    eyebrow: 'Design decision',
    published: '2026-08-12',
    readMinutes: 3,
    card: OG_CARDS.blogColorPicker,
    imageAlt: 'color it red. eleven colors. one of them rings.',
  },
  {
    slug: 'one-permanent-number',
    title: 'Every call comes from the same number, on purpose',
    description:
      'Telephony platforms hand out numbers by the pool. Wake Up Babe routes every call through one permanent number, because every Do Not Disturb exception is contact-shaped.',
    lede: 'Telephony platforms hand out numbers by the pool, and plenty of products call from whatever is available. We route every call through one permanent number, because everything the product promises depends on your phone knowing exactly who is calling.',
    eyebrow: 'Design decision',
    published: '2026-08-12',
    readMinutes: 3,
    card: OG_CARDS.blogOneNumber,
    imageAlt: 'same number, every time. the whole product rides on caller id.',
  },
  {
    slug: 'verification-call',
    title: 'Your account does not go live until the phone actually rings',
    description:
      'Wake Up Babe onboarding ends with a real call placed through your Do Not Disturb. No ring, no press 1, no active account. Here is why the friction stays.',
    lede: 'The last step of onboarding is a phone call placed while your Do Not Disturb is switched on. If it does not ring, or you do not press 1, you are not live. This loses us signups, and we are keeping it.',
    eyebrow: 'Product notes',
    published: '2026-08-12',
    readMinutes: 2,
    card: OG_CARDS.blogVerification,
    imageAlt: 'prove it rings. not live until you press 1.',
  },
];

/* Throws at build time, which is exactly when a typo'd slug should surface. */
export function getPost(slug: string): BlogPost {
  const post = POSTS.find((p) => p.slug === slug);
  if (!post) throw new Error(`No blog post registered for slug "${slug}"`);
  return post;
}

export function postMetadata(post: BlogPost): Metadata {
  return pageMetadata({
    title: post.title,
    description: post.description,
    path: postPath(post.slug),
    card: post.card,
    imageAlt: post.imageAlt,
    type: 'article',
  });
}
