import { BreadcrumbJsonLd } from '@/components/seo/json-ld';
import { ArticleShell, DataRow, Prose, Section } from '@/components/site/article';
import { Footer } from '@/components/site/footer';
import { Header } from '@/components/site/header';
import { pageMetadata } from '@/lib/seo';
import { GITHUB_URL, SUPPORT_EMAIL } from '@/lib/site';

const TITLE = 'Privacy Policy';
const DESCRIPTION =
  'What Wake Up Babe reads from your calendar, what it stores, who else touches it, and how to get rid of it. Read-only Google access, no analytics, no trackers.';
const UPDATED = '2026-08-04';

export const metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: '/privacy/',
  type: 'article',
});

export default function PrivacyPage() {
  return (
    <>
      <BreadcrumbJsonLd name={TITLE} path="/privacy/" />
      <Header />
      <main>
        <ArticleShell
          eyebrow="Legal"
          title="Privacy Policy"
          lede="This product reads your calendar and phones you. Both of those deserve a plain answer about what happens to the data, so here it is without the hedging."
          updated={UPDATED}
        >
          <Section n="01" title="The short version">
            <ul>
              <li>
                We ask Google for read-only calendar access. We cannot create, edit, delete or respond to
                anything in your calendar, and that is enforced by the scope, not by our good intentions.
              </li>
              <li>We do not record calls. There is no audio, anywhere, ever.</li>
              <li>
                We run no analytics, no advertising pixels and no third-party trackers on this website. This
                page set no cookies to show you this sentence.
              </li>
              <li>We do not sell your data, and we do not use it to train models.</li>
            </ul>
          </Section>

          <Section n="02" title="What we store">
            <Prose className="mb-6">
              Everything below lives in a Cloudflare D1 database. This is the whole list, taken from the
              schema rather than from memory.
            </Prose>
            <DataRow label="Google account">
              Your Google account identifier, email address and display name, from signing in.
            </DataRow>
            <DataRow label="Phone number">
              The number we call, plus its region, so we dial correctly and know which telephony route to use.
            </DataRow>
            <DataRow label="OAuth tokens">
              Your Google refresh and access tokens, encrypted at rest. They are what let us poll your
              calendar without asking you to sign in every five minutes.
            </DataRow>
            <DataRow label="Marked events">
              For events matching your trigger colour only: the title, start time, timezone, colour and how
              many people are invited. Events you have not marked are read during the sync and then discarded,
              not stored.
            </DataRow>
            <DataRow label="Call records">
              For each call: when we placed it, whether it was answered, when it ended, how it turned out, and
              the telephony provider&rsquo;s reference for it. No audio and no transcript.
            </DataRow>
            <DataRow label="Settings and usage">
              Your trigger colour, how far ahead you want the call, your timezone, your plan, and how many
              calls you have used this period.
            </DataRow>
            <DataRow label="Billing references">
              Identifiers issued by our payment provider so we can match a subscription to your account. We
              never see or store card details.
            </DataRow>
            <DataRow label="Feature votes">
              If you vote for a feature on the dashboard, the feature, your account and any note you leave.
            </DataRow>
            <DataRow label="Waitlist">
              If your region is not live yet: the email address and region you submitted, and nothing else.
            </DataRow>
          </Section>

          <Section n="03" title="How we use your Google Calendar data">
            <Prose>
              We poll your calendar roughly every five minutes, looking only for events in your trigger
              colour. When we find one, we schedule a call and store the handful of fields listed above so the
              call can say something useful when it rings. That is the entire purpose. We do not profile you,
              mine your meetings, or read your calendar for any reason unrelated to placing the call you asked
              for.
            </Prose>
            <Prose>
              <strong>
                Wake Up Babe&rsquo;s use and transfer of information received from Google APIs to any other
                app will adhere to the{' '}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  rel="noreferrer"
                  target="_blank"
                >
                  Google API Services User Data Policy
                </a>
                , including the Limited Use requirements.
              </strong>{' '}
              Concretely: your calendar data is used only to provide the reminder calls you signed up for, it
              is not transferred to anyone except the subprocessors listed below, it is not used for
              advertising, and no human at Wake Up Babe reads it except where you have explicitly asked us to
              help debug something, or where the law requires it.
            </Prose>
            <Prose>
              We do not use your calendar data, call records or any other personal data to train machine
              learning models.
            </Prose>
          </Section>

          <Section n="04" title="Who else touches it">
            <Prose className="mb-6">
              Running this requires other companies. Each one gets the minimum it needs to do its job.
            </Prose>
            <DataRow label="Google">
              The source of the calendar data, under the read-only scope you granted.
            </DataRow>
            <DataRow label="Cloudflare">
              Hosting, the database and the logs. Your data is stored and processed on Cloudflare
              infrastructure.
            </DataRow>
            <DataRow label="Twilio">
              Places the calls. Receives your phone number and the short briefing text that gets read aloud,
              which includes the event title.
            </DataRow>
            <DataRow label="Dodo Payments">
              Merchant of record for subscriptions. They handle the checkout and the card data. We receive
              only their identifiers and the resulting subscription status.
            </DataRow>
            <DataRow label="Resend">
              Sends the four transactional emails described below. Receives your email address and the
              contents of that email.
            </DataRow>
            <DataRow label="Sentry">
              Optional error reporting, when enabled. Receives error diagnostics, which can incidentally
              include account identifiers.
            </DataRow>
            <Prose className="mt-6">
              We do not sell your personal information, and we do not share it for cross-context behavioural
              advertising.
            </Prose>
          </Section>

          <Section n="05" title="Email we send you">
            <Prose>
              We send transactional email only, and there are exactly four kinds: a meeting was missed, you
              have spent your last call for the period, your phone number is still unverified, and your
              calendar connection has broken. The last two repeat at most once a week while the problem
              persists. There is no newsletter, and no marketing email. If your region is not live yet and you
              joined the waitlist, we email you once when it launches.
            </Prose>
          </Section>

          <Section n="06" title="Cookies">
            <Prose>
              This marketing site sets no cookies at all. Fonts are self-hosted at build time, so loading this
              page does not call out to Google.
            </Prose>
            <Prose>
              The dashboard at app.wakeupba.be sets one cookie, <code>wub_session</code>, which holds a signed
              reference to your account so you stay signed in. It is HttpOnly, Secure, SameSite=Lax and
              expires after 30 days. It is not a tracker and there is nothing else in it.
            </Prose>
          </Section>

          <Section n="07" title="How long we keep it">
            <Prose>
              Marked events and their call records stay while your account exists, because the call history is
              the receipt that the product works. Suppressed-duplicate email markers are pruned after 30 days.
              Waitlist entries are deleted once your region launches and you have been notified.
            </Prose>
            <Prose>
              Disconnecting your calendar from the dashboard revokes our access at Google and deletes your
              stored tokens immediately. To have your account and everything attached to it deleted, email{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> from your account address and we will
              action it within 30 days.
            </Prose>
          </Section>

          <Section n="08" title="Your rights">
            <Prose>
              Depending on where you live, you may have the right to access, correct, export or delete your
              personal data, to withdraw consent, and to object to processing. Two of those you can exercise
              yourself right now: your dashboard shows every event and call we hold, and the disconnect button
              cuts off the calendar access. For the rest, email{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. We will not charge you for it and we
              will not make you explain why.
            </Prose>
            <Prose>
              Our legal basis for processing, where that concept applies, is performance of the contract you
              entered into when you asked us to call you, and our legitimate interest in keeping the service
              working and unabused.
            </Prose>
          </Section>

          <Section n="09" title="International transfers">
            <Prose>
              We are US-first, and calls currently launch in the United States. Our subprocessors operate
              globally, which means your data may be processed outside your country, including in the United
              States. Where required, transfers rely on the relevant provider&rsquo;s standard contractual
              clauses.
            </Prose>
          </Section>

          <Section n="10" title="Security">
            <Prose>
              Google tokens are encrypted at rest. Session cookies are signed and cannot be edited by the
              browser. Requests that cost money or send email are rate limited. The service runs with the
              narrowest Google scope that makes it work, which is the single most effective security control
              here: even a total compromise of our systems cannot write to your calendar, because we never had
              permission to.
            </Prose>
            <Prose>
              The entire codebase is public at{' '}
              <a href={GITHUB_URL} rel="noreferrer" target="_blank">
                github.com/wakeupba/be
              </a>
              , so none of the above has to be taken on faith. If you find a security issue, email{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> rather than opening a public issue.
            </Prose>
          </Section>

          <Section n="11" title="Children">
            <Prose>
              This service is not intended for anyone under 16, and we do not knowingly collect their data.
            </Prose>
          </Section>

          <Section n="12" title="Changes and contact">
            <Prose>
              If this policy changes in a way that affects what we do with your data, we will update the date
              at the top and email you before it takes effect. Questions, requests and complaints go to{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
            </Prose>
          </Section>
        </ArticleShell>
      </main>
      <Footer />
    </>
  );
}
