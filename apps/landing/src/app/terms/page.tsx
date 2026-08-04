import { BreadcrumbJsonLd } from '@/components/seo/json-ld';
import { ArticleShell, Prose, Section } from '@/components/site/article';
import { Footer } from '@/components/site/footer';
import { Header } from '@/components/site/header';
import { pageMetadata } from '@/lib/seo';
import { GITHUB_URL, SUPPORT_EMAIL } from '@/lib/site';

const TITLE = 'Terms of Service';
const DESCRIPTION =
  'The deal: what Wake Up Babe promises, what it explicitly does not promise, how billing and cancellation work, and what happens when a call does not arrive.';
const UPDATED = '2026-08-04';

export const metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: '/terms/',
  type: 'article',
});

export default function TermsPage() {
  return (
    <>
      <BreadcrumbJsonLd name={TITLE} path="/terms/" />
      <Header />
      <main>
        <ArticleShell
          eyebrow="Legal"
          title="Terms of Service"
          lede="A reminder service is a promise about the future, so the important part of this document is the part where we tell you what we cannot promise. That is section 06."
          updated={UPDATED}
        >
          <Section n="01" title="The agreement">
            <Prose>
              Using Wake Up Babe means you accept these terms. If you do not, do not connect your calendar.
              You need to be at least 16 and legally able to enter into this agreement. If you are using it on
              behalf of an employer, you are confirming you have the authority to agree on their behalf.
            </Prose>
            <Prose>
              Throughout, &ldquo;we&rdquo; means the operators of Wake Up Babe and &ldquo;you&rdquo; means the
              person whose calendar is connected and whose phone rings.
            </Prose>
          </Section>

          <Section n="02" title="What the service does">
            <Prose>
              We poll your Google Calendar with read-only access, look for events in your chosen trigger
              colour, and place an automated phone call to your verified number ahead of those events. The
              call reads a short briefing and accepts a keypress: 1 acknowledges, 2 asks us to call again in
              about five minutes. If you do not answer, we try once more.
            </Prose>
            <Prose>
              Google Calendar is the only calendar we support today. Calls currently reach United States
              numbers. Other regions have a waitlist, and joining it is not a commitment from us to a date.
            </Prose>
          </Section>

          <Section n="03" title="Your side of it">
            <Prose>
              You are responsible for the accuracy of your phone number, for completing the Do Not Disturb
              verification, and for keeping your Google account connected. All three are things only you can
              do, and a call cannot arrive if any of them is wrong.
            </Prose>
            <Prose>You agree not to:</Prose>
            <ul>
              <li>Enter a phone number you are not entitled to receive calls on.</li>
              <li>
                Use the service to call anyone other than yourself, or to deliver anything other than your own
                meeting reminders.
              </li>
              <li>
                Attempt to defeat the call limits on your plan, or to automate account creation to get more
                free calls.
              </li>
              <li>
                Probe, overload or interfere with the service, or use it in a way that breaks the law where
                you are or where we operate.
              </li>
            </ul>
            <Prose>
              Using this to place unsolicited calls to other people is the one thing that gets an account
              terminated without warning.
            </Prose>
          </Section>

          <Section n="04" title="Plans, calls and billing">
            <Prose>
              Situationship is free and includes 5 calls a month. Ride or Die is $5 a month and includes 50. A
              call counts against your allowance when we place it, whether or not you answer, because the
              telephony cost lands either way. Retries of the same reminder do not count twice. The Do Not
              Disturb verification call is free.
            </Prose>
            <Prose>
              When you run out, we stop calling, tell you in the dashboard and send one email. Nothing is
              billed automatically beyond your subscription: there is no metered overage. You can top up with
              a $2 pack of 50 extra calls, up to a limit per period.
            </Prose>
            <Prose>
              Subscriptions renew monthly until cancelled and are handled by Dodo Payments as merchant of
              record, which means your contract for the payment itself is with them and their terms govern the
              transaction. Cancel any time from the dashboard. Cancelling stops the next renewal and you keep
              your remaining allowance until the period ends. We do not prorate refunds for a period already
              started, though if something on our side broke and cost you a meeting, email us and we will sort
              it out.
            </Prose>
            <Prose>Prices can change. If they do, we will email you before it affects your renewal.</Prose>
          </Section>

          <Section n="05" title="Cancellation and termination">
            <Prose>
              You can disconnect your calendar or stop using the service at any time, and you can ask us to
              delete your account by emailing <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. We may
              suspend or terminate an account that breaks section 03, that is being used to harass someone, or
              that we are legally required to close. Except for abuse, we will tell you why and give you a
              chance to fix it first.
            </Prose>
          </Section>

          <Section n="06" title="What we do not promise">
            <Prose>
              <strong>
                This is a reminder service, not a guarantee that you will be woken, reached or reminded.
              </strong>{' '}
              A call has to cross Google&rsquo;s API, our schedulers, a telephony carrier, your mobile
              network, and your phone&rsquo;s own notification settings. Any one of those can fail, and some
              of them are entirely outside our control.
            </Prose>
            <Prose>Specifically, we do not promise that:</Prose>
            <ul>
              <li>Every call will be placed, connect, or arrive at the exact minute you expected.</li>
              <li>
                Your phone will ring through Do Not Disturb. That depends on your own device configuration,
                which is exactly why setup ends with a verification call instead of a claim.
              </li>
              <li>Calendar changes made moments before an event will be picked up in time.</li>
              <li>The service will be available without interruption.</li>
            </ul>
            <Prose>
              Do not rely on Wake Up Babe as the only thing standing between you and something that genuinely
              cannot be missed: a flight, a court date, a medication, a medical appointment. Keep a second
              alarm for those. We built this because notifications get ignored, not because software is
              infallible.
            </Prose>
            <Prose>
              The service is provided as is, without warranties of any kind to the fullest extent the law
              allows.
            </Prose>
          </Section>

          <Section n="07" title="Liability">
            <Prose>
              To the extent the law permits, we are not liable for indirect, incidental or consequential
              damages, or for lost profits, lost opportunities, or the consequences of a meeting you missed.
              Our total liability for any claim is capped at the greater of the amount you paid us in the
              twelve months before the claim, or twenty US dollars.
            </Prose>
            <Prose>
              Nothing here excludes liability that cannot legally be excluded, and if you are a consumer, your
              statutory rights are unaffected.
            </Prose>
          </Section>

          <Section n="08" title="Third parties">
            <Prose>
              The service depends on Google, Cloudflare, Twilio, Dodo Payments and Resend. Your use of Google
              Calendar remains governed by your agreement with Google, and we are not responsible for their
              outages, policy changes, or decisions about your account. If Google revokes our access, the
              service stops working, and that is a risk you accept by using it.
            </Prose>
          </Section>

          <Section n="09" title="The code, and your data">
            <Prose>
              Wake Up Babe is open source under AGPL-3.0 at{' '}
              <a href={GITHUB_URL} rel="noreferrer" target="_blank">
                github.com/wakeupba/be
              </a>
              . The licence governs the code, not this hosted service, and these terms govern the hosted
              service, not the code. You are free to run your own instance under the AGPL, which includes its
              source-availability obligations. The name and the logo are ours and are not covered by the code
              licence.
            </Prose>
            <Prose>
              How we handle your data is described in the <a href="/privacy/">Privacy Policy</a>, which forms
              part of these terms.
            </Prose>
          </Section>

          <Section n="10" title="Changes">
            <Prose>
              We may update these terms. If a change materially affects your rights, we will email you and
              update the date at the top before it takes effect. Continuing to use the service after that
              means you accept the new version.
            </Prose>
          </Section>

          <Section n="11" title="Contact">
            <Prose>
              Anything at all: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
            </Prose>
          </Section>
        </ArticleShell>
      </main>
      <Footer />
    </>
  );
}
