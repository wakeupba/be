import type { TrackedEventRow } from '../../repos/events';

export interface BriefingScriptBuilder {
  build(event: TrackedEventRow): string;
}

/*
 * Calendar titles are written for eyes, not ears: "w/" reads as "with" but a
 * TTS voice spells it, and "🔥 standup" opens the call with "fire emoji".
 * This rewrites only the shorthand whose spoken form is unambiguous; anything
 * else is the title's own business. Ordered list, because "&" must not run
 * words together and emoji stripping can leave doubled spaces for the final
 * collapse to clean up.
 */
const SPOKEN_REWRITES: readonly [RegExp, string][] = [
  [/\p{Extended_Pictographic}|\u200d|\ufe0f/gu, ' '],
  [/\bw\//gi, 'with '],
  [/\b1[:-]1\b|\b1on1\b/gi, 'one on one'],
  [/\bmtg\b/gi, 'meeting'],
  [/&/g, ' and '],
];

export function speakableTitle(title: string): string {
  let spoken = title;
  for (const [pattern, replacement] of SPOKEN_REWRITES) {
    spoken = spoken.replace(pattern, replacement);
  }
  spoken = spoken.replace(/\s+/g, ' ').trim();
  // a title that was all emoji still deserves a sentence that parses
  return spoken.length > 0 ? spoken : 'your meeting';
}
/**
 * v1 strategy: deterministic template. An LLM-backed builder can implement the
 * same interface later; the dispatcher never knows the difference, and this
 * template stays as the fallback.
 */
export class TemplateScriptBuilder implements BriefingScriptBuilder {
  build(event: TrackedEventRow): string {
    const title = speakableTitle(event.title);
    const minutes = Math.round((event.startsAt - Date.now()) / 60000);
    const attendees = event.attendeeCount > 1 ? ` ${event.attendeeCount} people are expected.` : '';
    const timing =
      minutes >= 1
        ? `starts in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`
        : minutes >= -1
          ? 'is starting right now'
          : `started ${Math.abs(minutes)} minutes ago. Hurry`;
    return (
      `Wake up babe. ${title} ${timing}.` +
      attendees +
      ' Press 1 if you are on it. Press 2 and I will call again in 5 minutes.'
    );
  }
}

export const VERIFICATION_SCRIPT =
  'Wake up babe, it works. This is your verification call. Press 1 to prove you heard me through Do Not Disturb.';

/* The landing page demo. Says what it is in the first breath, because whoever
 * picks up did not necessarily type the number, and a mystery robocall is a
 * worse first impression than no demo at all. No prompt to press anything:
 * there is no account behind this call for a keypress to mean something to. */
export const DEMO_SCRIPT =
  'Hey, this is Wake Up Babe, calling because someone asked for a demo on our website. ' +
  'This is what you get before a meeting you painted red, straight through Do Not Disturb. ' +
  'That is the whole product. See you at wakeupba.be.';

export function defaultScriptBuilder(): BriefingScriptBuilder {
  return new TemplateScriptBuilder();
}
