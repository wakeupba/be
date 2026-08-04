import type { Metadata } from 'next';
import { canonicalPath, SITE_NAME } from './site';

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
 * So: pages describe themselves, this assembles the whole block, and the card
 * image is impossible to forget.
 */

const OG_IMAGE = '/opengraph-image.png';
const TWITTER_IMAGE = '/twitter-image.png';
const IMAGE_ALT =
  'Wake Up Babe. Color a meeting red in Google Calendar and your phone rings before it starts.';

export function pageMetadata({
  title,
  description,
  path,
  type = 'website',
}: {
  /* without the site name: the layout's title template appends it */
  title: string;
  description: string;
  path: string;
  type?: 'website' | 'article';
}): Metadata {
  const canonical = canonicalPath(path);
  const shareTitle = `${title} | ${SITE_NAME}`;
  const image = { url: OG_IMAGE, width: 1200, height: 600, alt: IMAGE_ALT };

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
      title: shareTitle,
      description,
      images: [{ ...image, url: TWITTER_IMAGE }],
    },
  };
}
