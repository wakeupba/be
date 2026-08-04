import { FAQS, PLANS } from '@/lib/content';
import { absoluteUrl, GITHUB_URL, SITE_NAME, SITE_TAGLINE, SITE_URL } from '@/lib/site';

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
            sameAs: [GITHUB_URL],
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
 * tells Google nothing, so the homepage does not get one. */
export function BreadcrumbJsonLd({ name, path }: { name: string; path: string }) {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name, item: absoluteUrl(path) },
        ],
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
