import type { TrackedEventRow } from '../../repos/events';

export interface BriefingScriptBuilder {
  build(event: TrackedEventRow): string;
}

/**
 * v1 strategy: deterministic template. An LLM-backed builder can implement the
 * same interface later; the dispatcher never knows the difference, and this
 * template stays as the fallback.
 */
export class TemplateScriptBuilder implements BriefingScriptBuilder {
  build(event: TrackedEventRow): string {
    const minutes = Math.round((event.startsAt - Date.now()) / 60000);
    const attendees = event.attendeeCount > 1 ? ` ${event.attendeeCount} people are expected.` : '';
    const timing =
      minutes >= 1
        ? `starts in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`
        : minutes >= -1
          ? 'is starting right now'
          : `started ${Math.abs(minutes)} minutes ago. Hurry`;
    return (
      `Wake up babe. ${event.title} ${timing}.` +
      attendees +
      ' Press 1 if you are on it. Press 2 and I will call again in 5 minutes.'
    );
  }
}

export const VERIFICATION_SCRIPT =
  'Wake up babe, it works. This is your verification call. Press 1 to prove you heard me through Do Not Disturb.';

export function defaultScriptBuilder(): BriefingScriptBuilder {
  return new TemplateScriptBuilder();
}
