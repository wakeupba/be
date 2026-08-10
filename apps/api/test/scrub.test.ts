import { scrubEvent, scrubText } from '@wakeupbabe/shared/scrub';
import { describe, expect, it } from 'vitest';

/*
 * The privacy page says error reports carry no identity, and the one identity
 * this product holds is a phone number. sendDefaultPii covers what Sentry
 * attaches; these cover what our own error messages smuggle.
 */
describe('phone scrubbing in error reports', () => {
  it('masks the shapes numbers actually arrive in', () => {
    // verbatim shape of a Twilio refusal body reaching an Error message
    expect(scrubText('twilio call failed: 400 {"message":"Account not authorized to call +919876543210."}')).not.toContain(
      '919876543210',
    );
    expect(scrubText('cannot ring +1 (415) 555-0123 today')).toBe('cannot ring [number] today');
    expect(scrubText('dialled 07400 123456 twice')).toBe('dialled [number] twice');
  });

  it('leaves short digit runs alone, so ids and codes stay debuggable', () => {
    expect(scrubText('HTTP 429 after 3 retries')).toBe('HTTP 429 after 3 retries');
    expect(scrubText('error 21215')).toBe('error 21215');
  });

  it('reaches every place a message can hide in an event', () => {
    const event = scrubEvent({
      message: 'refused +919876543210',
      exception: { values: [{ value: 'carrier said no to +14155550123' }] },
      breadcrumbs: [{ message: 'dialling +447400123456' }],
    });
    const flat = JSON.stringify(event);
    expect(flat).not.toMatch(/\d{7,}/);
    expect(flat).toContain('[number]');
  });
});
