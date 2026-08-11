function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/*
 * Without a voice attribute Twilio falls back to its legacy basic tier, the
 * 2010-robocall voice, which mangles anything a calendar title throws at it.
 * Neural is the "warm voice" the plan promises at $0.0032 per 100 characters:
 * a full briefing is ~500 characters, so about 1.6 cents per call, inside the
 * plan margin. Generative would be ~6.5 cents per call and eat it entirely.
 *
 * One voice everywhere, including regions where an en-IN voice might land
 * better (Polly.Kajal-Neural), because the brand IS the American "wake up
 * babe" delivery; revisit per-region only if users say otherwise.
 */
const VOICE = 'Polly.Joanna-Neural';
export interface GatherPrompt {
  speech: string;
  actionUrl: string;
  repeatSpeech: string;
}

/**
 * TwiML answer document: speak the briefing, collect one DTMF digit, and
 * repeat once for people who pick up late. If no digit arrives Twilio
 * continues past Gather and we say goodbye; the status callback decides
 * what that means.
 */
export function buildGatherXml(prompt: GatherPrompt): string {
  const speech = escapeXml(prompt.speech);
  const repeat = escapeXml(prompt.repeatSpeech);
  const action = escapeXml(prompt.actionUrl);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Response>',
    `<Gather input="dtmf" numDigits="1" timeout="8" action="${action}" method="POST">`,
    `<Say voice="${VOICE}">${speech}</Say>`,
    `<Say voice="${VOICE}">${repeat}</Say>`,
    '</Gather>',
    `<Say voice="${VOICE}">Okay, hanging up. Do not be late, babe.</Say>`,
    '</Response>',
  ].join('');
}

export function buildSpeakXml(speech: string): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Response>',
    `<Say voice="${VOICE}">${escapeXml(speech)}</Say>`,
    '</Response>',
  ].join('');
}
