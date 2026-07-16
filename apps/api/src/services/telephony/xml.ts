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
 * Plivo answer XML: speak the briefing, collect one DTMF digit, and repeat
 * once for people who pick up late. If no digit arrives Plivo continues past
 * GetInput and we say goodbye; the hangup webhook decides what that means.
 */
export function buildGatherXml(prompt: GatherPrompt): string {
  const speech = escapeXml(prompt.speech);
  const repeat = escapeXml(prompt.repeatSpeech);
  const action = escapeXml(prompt.actionUrl);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Response>',
    `<GetInput action="${action}" method="POST" inputType="dtmf" numDigits="1" executionTimeout="20" digitEndTimeout="5">`,
    `<Speak>${speech}</Speak>`,
    `<Speak>${repeat}</Speak>`,
    '</GetInput>',
    '<Speak>Okay, hanging up. Do not be late, babe.</Speak>',
    '</Response>',
  ].join('');
}

export function buildSpeakXml(speech: string): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Response>',
    `<Speak>${escapeXml(speech)}</Speak>`,
    '</Response>',
  ].join('');
}
