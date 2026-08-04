/*
 * Email copy, as pure functions. Separated from the transport so wording
 * changes are single-file diffs that cannot break sending, and so the exact
 * bytes a user receives are snapshot-testable.
 *
 * Voice rules, deliberately different from the product's voice: these are
 * failure notices, so they are plain and factual. No pet names, no jokes,
 * no taglines, no marketing phrasing, no exclamation marks. Cheeky copy in
 * a notification both reads badly when forwarded to a colleague and looks
 * promotional to spam classifiers.
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

/* meeting titles come from the user's calendar: escape before interpolating */
function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

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

/*
 * One HTML shell for every email: a single column, system fonts, mono for
 * machine values, one hairline above the footer. No images, no buttons, no
 * logo, no tracking. Restraint here is not only taste: buttons, images and
 * multi-column layouts are exactly what Gmail reads as promotional.
 */
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";

function shell(bodyHtml: string): string {
  return [
    `<div style="max-width:480px;font-family:${SANS};font-size:15px;line-height:1.6;color:#18181b">`,
    bodyHtml,
    `<div style="margin-top:28px;border-top:1px solid #e4e4e7;padding-top:12px">`,
    `<p style="margin:0;font-family:${MONO};font-size:11px;line-height:1.5;color:#71717a">${FOOTER}</p>`,
    `</div>`,
    `</div>`,
  ].join('');
}

function paragraph(html: string, muted = false): string {
  const color = muted ? ';color:#52525b' : '';
  return `<p style="margin:0 0 16px${color}">${html}</p>`;
}

function link(href: string, label: string): string {
  return `<p style="margin:0"><a href="${href}" style="color:#18181b;text-decoration:underline">${label}</a></p>`;
}

function mono(value: string): string {
  return `<span style="font-family:${MONO};font-size:14px">${escapeHtml(value)}</span>`;
}

export function missedCallEmail(input: {
  eventTitle: string;
  startsAt: number;
  timezone: string;
  reason: MissedReason;
  appOrigin: string;
}): RenderedEmail {
  const time = formatTime(input.startsAt, input.timezone, false);
  const reason = REASON_LINES[input.reason];
  return {
    subject: `Missed call: ${input.eventTitle}`,
    text: [
      `"${input.eventTitle}" started at ${time} and we could not reach you.`,
      '',
      reason,
      '',
      `Call history: ${input.appOrigin}/calls/`,
      '',
      FOOTER,
    ].join('\n'),
    html: shell(
      paragraph(`"${escapeHtml(input.eventTitle)}" started at ${mono(time)} and we could not reach you.`) +
        paragraph(reason, true) +
        link(`${input.appOrigin}/calls/`, 'Call history'),
    ),
  };
}

export function outOfCallsEmail(input: {
  upcoming: UpcomingMeeting[];
  timezone: string;
  appOrigin: string;
}): RenderedEmail {
  const shown = input.upcoming.slice(0, 5);
  const rows = shown.map((meeting) => ({
    when: formatTime(meeting.startsAt, input.timezone, true),
    title: meeting.title,
  }));
  return {
    subject: 'No calls left on your plan this month',
    text: [
      'That was the last call on your plan this month. These meetings are still',
      'flagged, and we will not be able to ring you for them:',
      '',
      ...rows.map((row) => `  ${row.when}  ${row.title}`),
      '',
      `Plan and top-ups: ${input.appOrigin}/billing/`,
      '',
      FOOTER,
    ].join('\n'),
    html: shell(
      paragraph(
        'That was the last call on your plan this month. These meetings are still flagged, and we will not be able to ring you for them:',
      ) +
        `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border-collapse:collapse">${rows
          .map(
            (row) =>
              `<tr><td style="padding:0 16px 4px 0;font-family:${MONO};font-size:13px;color:#52525b;white-space:nowrap">${escapeHtml(row.when)}</td><td style="padding:0 0 4px">${escapeHtml(row.title)}</td></tr>`,
          )
          .join('')}</table>` +
        link(`${input.appOrigin}/billing/`, 'Plan and top-ups'),
    ),
  };
}

export function numberUnverifiedEmail(input: { appOrigin: string }): RenderedEmail {
  const lead =
    'Your phone number has not passed the test call, so we cannot ring it. Flagged meetings are being missed.';
  return {
    subject: 'Calls paused: your number is not verified',
    text: [lead, '', `Verify your number: ${input.appOrigin}/call-setup/`, '', FOOTER].join('\n'),
    html: shell(paragraph(lead) + link(`${input.appOrigin}/call-setup/`, 'Verify your number')),
  };
}

export function calendarBrokenEmail(input: { appOrigin: string }): RenderedEmail {
  const lead = 'Google revoked our read access to your calendar.';
  const detail =
    'Meetings we already flagged will still ring at their last known times, but new events, changes, and cancellations are invisible to us until you reconnect.';
  return {
    subject: 'Google Calendar access needs reconnecting',
    text: [lead, '', detail, '', `Reconnect: ${input.appOrigin}/call-setup/`, '', FOOTER].join('\n'),
    html: shell(
      paragraph(lead) + paragraph(detail, true) + link(`${input.appOrigin}/call-setup/`, 'Reconnect'),
    ),
  };
}
