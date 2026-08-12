import { BreadcrumbJsonLd, ContactJsonLd } from '@/components/seo/json-ld';
import { ArticleShell, DataRow, Prose, Section } from '@/components/site/article';
import { Footer } from '@/components/site/footer';
import { Header } from '@/components/site/header';
import { OG_CARDS, pageMetadata } from '@/lib/seo';
import { GITHUB_URL, SECURITY_ADVISORY_URL, SUPPORT_EMAIL, TWITTER_HANDLE, X_DM_URL } from '@/lib/site';

const PATH = '/contact/';
const TITLE = 'Contact';
const DESCRIPTION =
  'A direct message for anything quick, one address for billing and data requests, GitHub for bugs, and private advisories for security. No ticket system, no contact form that goes nowhere.';
const UPDATED = '2026-08-06';

export const metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
  card: OG_CARDS.contact,
  imageAlt: 'Contact us. wakeupba.be',
  type: 'website',
});

export default function ContactPage() {
  return (
    <>
      <ContactJsonLd path={PATH} />
      <BreadcrumbJsonLd name={TITLE} path={PATH} />
      <Header />
      <main>
        <ArticleShell
          eyebrow="Contact"
          title="Ways to reach a person"
          lede="There is no ticket system and no contact form, because this site is a static export with nothing behind it to receive one. What follows is every route that actually goes somebody."
          updated={UPDATED}
        >
          <Section n="01" title="Where to send what">
            <DataRow
              label={
                <a
                  href={X_DM_URL}
                  rel="noreferrer"
                  target="_blank"
                  className="underline decoration-line underline-offset-[3px] transition-colors duration-150 hover:decoration-accent"
                >
                  {TWITTER_HANDLE}
                </a>
              }
            >
              The quickest. This opens a message rather than a profile, and it lands on a phone instead of in
              an inbox. Best for the short things: it did not ring, is it meant to do that, here is an idea.
              One person reads it, and it is the person who wrote the thing.
            </DataRow>
            <DataRow
              label={
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="underline decoration-line underline-offset-[3px] transition-colors duration-150 hover:decoration-accent"
                >
                  {SUPPORT_EMAIL}
                </a>
              }
            >
              Anything attached to your account: a billing question, a refund, a data request, a deletion.
              Slower than a message, and the better choice when there should be a record of it, or when you
              would rather not raise it on a social network.
            </DataRow>
            <DataRow label="GitHub issues">
              Bugs and feature requests, if you are comfortable in public. They are easier to track there and
              someone else may have hit the same thing. See{' '}
              <a href={`${GITHUB_URL}/issues`} rel="noreferrer" target="_blank">
                github.com/wakeupba/be/issues
              </a>
              .
            </DataRow>
            <DataRow label="Private advisory">
              Security vulnerabilities, and only through here, never a public issue and not the support inbox.{' '}
              <a href={SECURITY_ADVISORY_URL} rel="noreferrer" target="_blank">
                Open a private advisory
              </a>{' '}
              and you get an acknowledgement within 72 hours.
            </DataRow>
            <DataRow label="The dashboard">
              Votes on what gets built next, including Outlook support. Those are counted, which is more than
              an email about it would be.
            </DataRow>
          </Section>

          <Section n="02" title="How fast">
            <Prose>
              Honestly: this is a small operation, so everything is answered by a person when that person is
              awake, and paid accounts go first because priority support is the thing Ride or Die pays for. A
              direct message is seen soonest, since it arrives as a notification and the inbox does not. No
              automated first reply and no ticket number, which cuts both ways. If something is broken and
              costing you meetings, say so in the first line and it gets read that way.
            </Prose>
            <Prose>
              The one commitment with a number on it is the security one, because it is written down in{' '}
              <a href={`${GITHUB_URL}/blob/main/.github/SECURITY.md`} rel="noreferrer" target="_blank">
                SECURITY.md
              </a>
              : 72 hours to acknowledge, then a status update at least weekly until it is resolved.
            </Prose>
          </Section>

          <Section n="03" title="Data and deletion requests">
            <Prose>
              Two of these you can do yourself, immediately, without asking. Your dashboard lists every event
              and call we hold, and the disconnect button revokes our Google access and deletes the stored
              tokens on the spot.
            </Prose>
            <Prose>
              For a full account deletion or an export, email{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> from your account address so we know it
              is you. We will action it within 30 days, we will not charge for it, and we will not ask why.
              The <a href="/privacy/">privacy policy</a> sets out what exists to be deleted.
            </Prose>
          </Section>

          <Section n="04" title="Billing">
            <Prose>
              Subscriptions run through Dodo Payments as merchant of record, which means the payment contract
              is with them and their name is what shows on your statement. Cancelling and updating a card are
              both self-serve from the dashboard.
            </Prose>
            <Prose>
              Email us first for anything else, including refunds. We can see your plan and your call history,
              which is usually enough to sort it out without involving anybody else. Where a payment dispute
              has to go through Dodo, we will tell you that rather than leave you guessing.
            </Prose>
          </Section>

          <Section n="05" title="Self-hosting">
            <Prose>
              If you are running your own instance, the repository is the right place: the code is AGPL-3.0 at{' '}
              <a href={GITHUB_URL} rel="noreferrer" target="_blank">
                github.com/wakeupba/be
              </a>
              , and setup questions belong in an issue where the answer is useful to the next person. The
              support inbox is for the hosted service, since debugging someone else&rsquo;s Twilio account is
              not something we can do from here.
            </Prose>
          </Section>
        </ArticleShell>
      </main>
      <Footer />
    </>
  );
}
