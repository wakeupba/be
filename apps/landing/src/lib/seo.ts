import type { Metadata } from 'next';
import { canonicalPath, SITE_NAME, TWITTER_HANDLE } from './site';

/*
 * Page metadata builder.
 *
 * The reason this exists rather than each page writing its own object: Next
 * merges the `openGraph` key by replacement, not by field. A page that sets
 * `openGraph.title` to fix its share text silently drops the root layout's
 * image, and the root `opengraph-image.png` file convention does not backfill
 * it. The result is a page that looks fine in the head and shares as a bare
 * link. Every subpage had that bug before this function existed.
 *
 * So: pages describe themselves, this assembles the whole block, and the card is
 * impossible to forget.
 */

/* Per-page cards live in public/og. The homepage keeps the brand card from the
 * app-directory file convention, so it is not listed here. */
export const OG_CARDS = {
  pricing: '/og/pricing.png',
  calendarReminders: '/og/calendar-reminders.png',
  dnd: '/og/dnd.png',
  alternatives: '/og/alternatives.png',
  legal: '/og/legal.png',
  contact: '/og/contact.png',
  blog: '/og/blog.png',
  blogColorPicker: '/og/blog-color-picker.png',
  blogOneNumber: '/og/blog-one-number.png',
  blogVerification: '/og/blog-verification.png',
  blogWhyCall: '/og/blog-why-call.png',
} as const;

type OgCard = (typeof OG_CARDS)[keyof typeof OG_CARDS];

/* Every card is 1200x600. Exactly 2:1 is what X wants for a large-image card;
 * Facebook and LinkedIn prefer 1.91:1 and trim a few pixels off the long edge,
 * which is why nothing load-bearing sits near the top or bottom of the art. */
const CARD_WIDTH = 1200;
const CARD_HEIGHT = 600;

export function pageMetadata({
  title,
  description,
  path,
  card,
  imageAlt,
  type = 'website',
}: {
  /* without the site name: the layout's title template appends it */
  title: string;
  description: string;
  path: string;
  card: OgCard;
  /* what the card actually says, not a description of the page */
  imageAlt: string;
  type?: 'website' | 'article';
}): Metadata {
  const canonical = canonicalPath(path);
  const shareTitle = `${title} | ${SITE_NAME}`;
  const image = {
    url: card,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    alt: imageAlt,
    type: 'image/png',
  };

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: shareTitle,
      description,
      url: canonical,
      siteName: SITE_NAME,
      locale: 'en_US',
      type,
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      site: TWITTER_HANDLE,
      creator: TWITTER_HANDLE,
      title: shareTitle,
      description,
      images: [image],
    },
  };
}
