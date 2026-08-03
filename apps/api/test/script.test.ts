import { describe, expect, it } from 'vitest';
import type { TrackedEventRow } from '../src/repos/events';
import { TemplateScriptBuilder } from '../src/services/calls/script';

function eventIn(minutesFromNow: number, overrides: Partial<TrackedEventRow> = {}): TrackedEventRow {
  const now = Date.now();
  return {
    id: 'evt_1',
    userId: 'usr_1',
    googleEventId: 'gev_1',
    calendarId: 'primary',
    title: 'Board meeting',
    startsAt: now + minutesFromNow * 60_000,
    eventTimezone: 'UTC',
    attendeeCount: 1,
    colorId: '11',
    callAt: now,
    state: 'calling',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('TemplateScriptBuilder', () => {
  const builder = new TemplateScriptBuilder();

  it('announces minutes until start', () => {
    const script = builder.build(eventIn(15));
    expect(script).toContain('Wake up babe. Board meeting starts in 15 minutes.');
    expect(script).toContain('Press 1');
    expect(script).toContain('Press 2');
  });

  it('uses the singular for one minute', () => {
    expect(builder.build(eventIn(1))).toContain('starts in 1 minute.');
  });

  it('says starting right now around the start time', () => {
    expect(builder.build(eventIn(0))).toContain('is starting right now');
  });

  it('hurries the user when the meeting already started', () => {
    const script = builder.build(eventIn(-5));
    expect(script).toMatch(/started \d+ minutes ago. Hurry/);
  });

  it('mentions attendees only when more than one', () => {
    expect(builder.build(eventIn(10, { attendeeCount: 4 }))).toContain('4 people are expected.');
    expect(builder.build(eventIn(10, { attendeeCount: 1 }))).not.toContain('people are expected');
  });
});
