/*
 * Redaction for error reports, shared by the worker's Sentry init and the
 * dashboard's.
 *
 * The privacy policy promises that error reports carry no identity, and
 * setting sendDefaultPii false only covers what Sentry itself attaches.
 * Exception *messages* are ours to police: a Twilio refusal echoes the dialled
 * number back in its error body, and that body ends up verbatim in the thrown
 * Error. So every string in an outgoing event gets phone-shaped sequences
 * masked before it leaves.
 *
 * The pattern is deliberately blunt. Seven or more digits with optional +,
 * spaces, dashes or parens is occasionally a timestamp or an id, and masking
 * one of those costs a little debuggability; missing a phone number costs a
 * promise. Blunt in the safe direction.
 */

const PHONE_SHAPED = /\+?\d[\d\s\-()]{5,}\d/g;

export function scrubText(text: string): string {
  return text.replace(PHONE_SHAPED, (match) => {
    const digits = match.replace(/\D/g, '');
    return digits.length >= 7 ? '[number]' : match;
  });
}

interface ScrubbableEvent {
  message?: string;
  exception?: { values?: Array<{ value?: string }> };
  breadcrumbs?: Array<{ message?: string }>;
}

/** a beforeSend for Sentry inits: masks phone-shaped digit runs everywhere a
 * message can hide, and never blocks the event itself */
export function scrubEvent<E extends ScrubbableEvent>(event: E): E {
  if (event.message) event.message = scrubText(event.message);
  for (const value of event.exception?.values ?? []) {
    if (value.value) value.value = scrubText(value.value);
  }
  for (const crumb of event.breadcrumbs ?? []) {
    if (crumb.message) crumb.message = scrubText(crumb.message);
  }
  return event;
}
