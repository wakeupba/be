import { Body, Container, Head, Hr, Html, Link, Preview, render, Section, Text } from 'react-email';

/*
 * Email copy as react-email components. The library buys three things a
 * hand-rolled string could not: a real document (<Html lang>, <Head>, and
 * the <title> that <Preview> emits), preheader text so we control the grey
 * snippet next to the subject instead of leaking the first body line, and
 * table-based output that survives Outlook's rendering engine. Plain text
 * is generated from the same tree, so the two parts can never drift.
 *
 * Voice rules, deliberately different from the product's voice: these are
 * failure notices, so they are plain and factual. No pet names, no jokes,
 * no taglines, no exclamation marks. Cheeky copy in a notification reads
 * badly when forwarded to a colleague and reads promotional to spam
 * classifiers.
 *
 * Design rules, same reason: no logo image, no buttons, no hero heading,
 * no background panels. A logo plus a button on a colored card is exactly
 * the shape Gmail files under Promotions. One column, system fonts, mono
 * for machine values, one hairline above the footer.
 */

export type MissedReason = 'no_answer' | 'failed' | 'out_of_calls';

export interface UpcomingMeeting {
  id: string;
  title: string;
  startsAt: number;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

const FOOTER = 'Wake Up Babe · you received this because a scheduled call could not reach you.';

const REASON_LINES: Record<MissedReason, string> = {
  no_answer: 'We called and there was no answer.',
  failed: 'The call could not be placed.',
  out_of_calls: 'You had no calls left this month, so we did not dial.',
};

const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";

const styles = {
  body: { backgroundColor: '#ffffff', fontFamily: SANS, margin: 0 },
  container: { maxWidth: '480px', margin: '0 auto', padding: '32px 24px' },
  text: { fontSize: '15px', lineHeight: '1.6', color: '#18181b', margin: '0 0 16px' },
  muted: { fontSize: '15px', lineHeight: '1.6', color: '#52525b', margin: '0 0 16px' },
  mono: { fontFamily: MONO, fontSize: '14px' },
  link: { fontSize: '15px', color: '#18181b', textDecoration: 'underline' },
  hr: { borderColor: '#e4e4e7', borderStyle: 'solid', margin: '28px 0 12px' },
  footer: { fontFamily: MONO, fontSize: '11px', lineHeight: '1.5', color: '#71717a', margin: 0 },
  row: { fontSize: '14px', lineHeight: '1.6', color: '#18181b', margin: '0 0 4px' },
  when: { fontFamily: MONO, fontSize: '13px', color: '#52525b' },
} as const;

function formatTime(startsAt: number, timezone: string, withWeekday: boolean): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      ...(withWeekday ? { weekday: 'short' } : {}),
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone,
    }).format(new Date(startsAt));
  } catch {
    return new Date(startsAt).toISOString();
  }
}

/** the one shell every email shares: document, preheader, hairline, footer */
function Shell({ preview, children }: { preview: string; children: React.ReactNode }) {
  return (
    <Html lang="en">
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
      </Head>
      <Body style={styles.body}>
        <Preview>{preview}</Preview>
        <Container style={styles.container}>
          {children}
          <Hr style={styles.hr} />
          <Text style={styles.footer}>{FOOTER}</Text>
        </Container>
      </Body>
    </Html>
  );
}

export function MissedCall({
  eventTitle,
  startsAt,
  timezone,
  reason,
  appOrigin,
}: {
  eventTitle: string;
  startsAt: number;
  timezone: string;
  reason: MissedReason;
  appOrigin: string;
}) {
  const time = formatTime(startsAt, timezone, false);
  return (
    <Shell preview={`${REASON_LINES[reason]} ${eventTitle} started at ${time}.`}>
      <Text style={styles.text}>
        "{eventTitle}" started at <span style={styles.mono}>{time}</span> and we could not reach you.
      </Text>
      <Text style={styles.muted}>{REASON_LINES[reason]}</Text>
      <Link href={`${appOrigin}/calls/`} style={styles.link}>
        Call history
      </Link>
    </Shell>
  );
}

export function OutOfCalls({
  upcoming,
  timezone,
  appOrigin,
}: {
  upcoming: UpcomingMeeting[];
  timezone: string;
  appOrigin: string;
}) {
  const shown = upcoming.slice(0, 5);
  return (
    <Shell preview="Flagged meetings will not ring until you have calls again.">
      <Text style={styles.text}>
        That was the last call on your plan this month.{' '}
        {shown.length === 1
          ? 'This meeting is still flagged, and we will not be able to ring you for it:'
          : 'These meetings are still flagged, and we will not be able to ring you for them:'}
      </Text>
      <Section style={{ margin: '0 0 16px' }}>
        {shown.map((meeting) => (
          <Text key={meeting.id} style={styles.row}>
            <span style={styles.when}>{formatTime(meeting.startsAt, timezone, true)}</span>
            {'  '}
            {meeting.title}
          </Text>
        ))}
      </Section>
      <Link href={`${appOrigin}/billing/`} style={styles.link}>
        Plan and top-ups
      </Link>
    </Shell>
  );
}

export function NumberUnverified({ appOrigin }: { appOrigin: string }) {
  return (
    <Shell preview="Your number has not passed the test call, so we cannot ring it.">
      <Text style={styles.text}>
        Your phone number has not passed the test call, so we cannot ring it. Flagged meetings are being
        missed.
      </Text>
      <Link href={`${appOrigin}/call-setup/`} style={styles.link}>
        Verify your number
      </Link>
    </Shell>
  );
}

/*
 * The number on file costs more to ring than the plan covers. Distinct from
 * NumberUnverified on purpose: that one asks for a test call, and here the test
 * call is refused too, so sending them to run it would be a loop. The only
 * action that helps is a different number, so that is the only one offered.
 */
export function NumberUnreachable({ appOrigin }: { appOrigin: string }) {
  return (
    <Shell preview="We cannot place calls to your number, so flagged meetings will not ring.">
      <Text style={styles.text}>
        We can no longer place calls to the number on your account, so flagged meetings are not ringing.
      </Text>
      <Text style={styles.muted}>
        Call costs to some networks have risen past what the plan covers. This is not something you did, and
        it is not a problem with your phone. If you have a number on another network, adding it will start the
        calls again.
      </Text>
      <Link href={`${appOrigin}/call-setup/`} style={styles.link}>
        Change your number
      </Link>
    </Shell>
  );
}

export function CalendarBroken({ appOrigin }: { appOrigin: string }) {
  return (
    <Shell preview="We can no longer see new events, changes, or cancellations.">
      <Text style={styles.text}>Google revoked our read access to your calendar.</Text>
      <Text style={styles.muted}>
        Meetings we already flagged will still ring at their last known times, but new events, changes, and
        cancellations are invisible to us until you reconnect.
      </Text>
      <Link href={`${appOrigin}/call-setup/`} style={styles.link}>
        Reconnect
      </Link>
    </Shell>
  );
}

/** html and plain text come from the same tree, so they cannot drift */
async function renderBoth(subject: string, element: React.ReactElement): Promise<RenderedEmail> {
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  return { subject, text, html };
}

export function missedCallEmail(input: {
  eventTitle: string;
  startsAt: number;
  timezone: string;
  reason: MissedReason;
  appOrigin: string;
}): Promise<RenderedEmail> {
  return renderBoth(`Missed call: ${input.eventTitle}`, <MissedCall {...input} />);
}

export function outOfCallsEmail(input: {
  upcoming: UpcomingMeeting[];
  timezone: string;
  appOrigin: string;
}): Promise<RenderedEmail> {
  return renderBoth('No calls left on your plan this month', <OutOfCalls {...input} />);
}

export function numberUnverifiedEmail(input: { appOrigin: string }): Promise<RenderedEmail> {
  return renderBoth('Calls paused: your number is not verified', <NumberUnverified {...input} />);
}

export function numberUnreachableEmail(input: { appOrigin: string }): Promise<RenderedEmail> {
  return renderBoth('Calls paused: we cannot reach your number', <NumberUnreachable {...input} />);
}

export function calendarBrokenEmail(input: { appOrigin: string }): Promise<RenderedEmail> {
  return renderBoth('Google Calendar access needs reconnecting', <CalendarBroken {...input} />);
}
