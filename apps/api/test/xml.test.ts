import { describe, expect, it } from 'vitest';
import { buildGatherXml, buildSpeakXml } from '../src/services/telephony/xml';

/*
 * Twilio falls back to its legacy robocall voice whenever a <Say> omits the
 * voice attribute, so "every Say names the neural voice" is a contract, not a
 * detail: one forgotten attribute and that block of the call sounds like a
 * different, worse product.
 */
describe('TwiML voice', () => {
  it('every Say in the briefing document names the neural voice', () => {
    const xml = buildGatherXml({
      speech: 'Wake up babe.',
      repeatSpeech: 'Still there?',
      actionUrl: 'https://api.test/hooks/call/input',
    });
    const says = xml.match(/<Say[^>]*>/g) ?? [];
    expect(says).toHaveLength(3);
    for (const say of says) {
      expect(say).toContain('voice="Polly.Joanna-Neural"');
    }
  });

  it('the single-utterance document names it too', () => {
    expect(buildSpeakXml('Bye, babe.')).toContain('<Say voice="Polly.Joanna-Neural">Bye, babe.</Say>');
  });

  it('still escapes user-controlled text inside the voiced Say', () => {
    const xml = buildSpeakXml('Fundraise <$2M> & exit');
    expect(xml).toContain('Fundraise &lt;$2M&gt; &amp; exit');
  });
});
