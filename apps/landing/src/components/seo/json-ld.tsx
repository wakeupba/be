import { AUTHOR, type BlogPost, POSTS, postPath } from '@/lib/blog';
import { FAQS, PLANS } from '@/lib/content';
import { absoluteUrl, GITHUB_URL, SITE_NAME, SITE_TAGLINE, SITE_URL, SUPPORT_EMAIL, X_URL } from '@/lib/site';

/* Stable @ids so the graph nodes can reference each other instead of repeating
 * themselves. Google follows these; humans never see them. */
const ORG_ID = `${SITE_URL}/#organization`;
const SITE_ID = `${SITE_URL}/#website`;
const APP_ID = `${SITE_URL}/#software`;

/* JSON.stringify does not escape `<`, so a stray HTML tag in any of the copy
 * above could break out of the script element. Nothing in content.ts contains
 * one today, but the copy is edited by hand and this costs one replace. */
function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: the only way to emit a ld+json script body
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}

/* Sitewide identity. Rendered once from the root layout, so every page carries
 * the publisher and the site node without each one restating it. */
export function SiteJsonLd() {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Organization',
            '@id': ORG_ID,
            name: SITE_NAME,
            url: SITE_URL,
            logo: `${SITE_URL}/icon-512.png`,
            description: SITE_TAGLINE,
            sameAs: [GITHUB_URL, X_URL],
          },
          {
            '@type': 'WebSite',
            '@id': SITE_ID,
            name: SITE_NAME,
            url: SITE_URL,
            description: SITE_TAGLINE,
            publisher: { '@id': ORG_ID },
            inLanguage: 'en',
          },
        ],
      }}
    />
  );
}

/* The product itself, with both plans as real Offers.
 *
 * SoftwareApplication rather than Product: this is software with a price, and
 * the application subtype is what earns the pricing and category treatment in
 * results. operatingSystem is 'Any' because the surface is a phone call — the
 * only requirement is a phone that rings. */
export function SoftwareJsonLd() {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        '@id': APP_ID,
        name: SITE_NAME,
        url: SITE_URL,
        description: SITE_TAGLINE,
        applicationCategory: 'BusinessApplication',
        applicationSubCategory: 'Calendar reminders',
        operatingSystem: 'Any',
        image: `${SITE_URL}/opengraph-image.png`,
        publisher: { '@id': ORG_ID },
        isAccessibleForFree: true,
        license: `${GITHUB_URL}/blob/main/LICENSE`,
        featureList: [
          'Phone call reminders for color-marked Google Calendar events',
          'Rings through Do Not Disturb on iOS and Android',
          'Keypad acknowledge and snooze',
          'Read-only calendar access',
          'Call history and delivery receipts',
        ],
        offers: PLANS.map((plan) => ({
          '@type': 'Offer',
          name: plan.name,
          description: plan.description,
          price: plan.priceValue,
          priceCurrency: 'USD',
          url: absoluteUrl('/pricing/'),
          availability: 'https://schema.org/InStock',
          ...(plan.priceValue > 0 && {
            priceSpecification: {
              '@type': 'UnitPriceSpecification',
              price: plan.priceValue,
              priceCurrency: 'USD',
              billingDuration: 1,
              billingIncrement: 1,
              unitCode: 'MON',
            },
          }),
        })),
      }}
    />
  );
}

/* Mirrors the accordion one-for-one, straight off the same FAQS array. */
export function FaqJsonLd() {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        '@id': `${SITE_URL}/#faq`,
        isPartOf: { '@id': SITE_ID },
        mainEntity: FAQS.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: { '@type': 'Answer', text: faq.answer },
        })),
      }}
    />
  );
}

/* Subpages only. A breadcrumb whose single item is the page you are already on
 * tells Google nothing, so the homepage does not get one. Blog posts pass the
 * index as a parent so the trail reads Home > Blog > post. */
export function BreadcrumbJsonLd({
  name,
  path,
  parents = [],
}: {
  name: string;
  path: string;
  parents?: { name: string; path: string }[];
}) {
  const trail = [
    { name: 'Home', item: SITE_URL },
    ...parents.map((parent) => ({ name: parent.name, item: absoluteUrl(parent.path) })),
    { name, item: absoluteUrl(path) },
  ];
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: trail.map((crumb, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: crumb.name,
          item: crumb.item,
        })),
      }}
    />
  );
}

/* The contact routes, attached to the Organization node so the email is
 * associated with the publisher rather than floating loose on a page. Only the
 * support inbox is listed: security disclosures go through GitHub advisories, and
 * advertising a second channel for them would undercut SECURITY.md. */
export function ContactJsonLd({ path }: { path: string }) {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'ContactPage',
        '@id': `${absoluteUrl(path)}#contact`,
        url: absoluteUrl(path),
        name: `Contact ${SITE_NAME}`,
        isPartOf: { '@id': SITE_ID },
        inLanguage: 'en',
        about: {
          '@id': ORG_ID,
          '@type': 'Organization',
          name: SITE_NAME,
          url: SITE_URL,
          email: SUPPORT_EMAIL,
          contactPoint: [
            {
              '@type': 'ContactPoint',
              contactType: 'customer support',
              email: SUPPORT_EMAIL,
              availableLanguage: 'English',
            },
          ],
        },
      }}
    />
  );
}

const BLOG_ID = `${SITE_URL}/blog/#blog`;

/* The index page: a Blog node that lists its posts by reference, so the graph
 * says "these belong together" without restating each post's full markup. */
export function BlogJsonLd({ description }: { description: string }) {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'Blog',
        '@id': BLOG_ID,
        url: absoluteUrl('/blog/'),
        name: `${SITE_NAME} blog`,
        description,
        publisher: { '@id': ORG_ID },
        isPartOf: { '@id': SITE_ID },
        inLanguage: 'en',
        blogPost: POSTS.map((post) => ({
          '@type': 'BlogPosting',
          '@id': `${absoluteUrl(postPath(post.slug))}#post`,
          headline: post.title,
          url: absoluteUrl(postPath(post.slug)),
          datePublished: post.published,
        })),
      }}
    />
  );
}

/* One post. The author is a named person because an anonymous byline is the
 * fastest way to read as content-farm output, to Google and to humans. */
export function BlogPostingJsonLd({ post }: { post: BlogPost }) {
  const url = absoluteUrl(postPath(post.slug));
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        '@id': `${url}#post`,
        mainEntityOfPage: url,
        url,
        headline: post.title,
        description: post.description,
        datePublished: post.published,
        dateModified: post.updated ?? post.published,
        author: {
          '@type': 'Person',
          name: AUTHOR.name,
          url: AUTHOR.url,
          image: `${SITE_URL}${AUTHOR.avatar}`,
        },
        publisher: { '@id': ORG_ID },
        isPartOf: { '@id': BLOG_ID },
        image: `${SITE_URL}${post.card}`,
        inLanguage: 'en',
      }}
    />
  );
}

/* For the keyword pages: they are articles about a problem, not product pages,
 * and WebPage + primary topic is the honest description of what they are. */
export function WebPageJsonLd({
  name,
  description,
  path,
  lastModified,
}: {
  name: string;
  description: string;
  path: string;
  lastModified: string;
}) {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        '@id': `${absoluteUrl(path)}#webpage`,
        url: absoluteUrl(path),
        name,
        description,
        dateModified: lastModified,
        isPartOf: { '@id': SITE_ID },
        about: { '@id': APP_ID },
        publisher: { '@id': ORG_ID },
        inLanguage: 'en',
      }}
    />
  );
}
