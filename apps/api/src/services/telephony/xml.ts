function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

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
    `<Say>${speech}</Say>`,
    `<Say>${repeat}</Say>`,
    '</Gather>',
    '<Say>Okay, hanging up. Do not be late, babe.</Say>',
    '</Response>',
  ].join('');
}

export function buildSpeakXml(speech: string): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Response>',
    `<Say>${escapeXml(speech)}</Say>`,
    '</Response>',
  ].join('');
}
