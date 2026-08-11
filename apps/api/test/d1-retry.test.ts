import { describe, expect, it, vi } from 'vitest';
import { retryingD1 } from '../src/db/client';

/*
 * The retry wrapper exists for the documented family of transient D1 faults:
 * a query that throws "Network connection lost" once and succeeds when
 * re-sent. These tests pin the contract: that family is retried with the
 * original result returned, everything else (constraint violations, SQL
 * errors) surfaces immediately, and retries are bounded.
 */

const TRANSIENT = () => new Error('D1_ERROR: Network connection lost.');

interface StubOverrides {
  run?: () => Promise<unknown>;
  all?: () => Promise<unknown>;
  first?: () => Promise<unknown>;
}

function stubStatement(overrides: StubOverrides = {}): D1PreparedStatement {
  const statement = {
    bind: () => statement,
    run: overrides.run ?? (async () => ({ success: true })),
    all: overrides.all ?? (async () => ({ results: [] })),
    raw: async () => [],
    first: overrides.first ?? (async () => null),
  };
  return statement as unknown as D1PreparedStatement;
}

function stubD1(statement: D1PreparedStatement): D1Database {
  return {
    prepare: () => statement,
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
    dump: async () => new ArrayBuffer(0),
  } as unknown as D1Database;
}

describe('retryingD1', () => {
  it('retries a transient failure and returns the eventual result', async () => {
    const run = vi
      .fn()
      .mockRejectedValueOnce(TRANSIENT())
      .mockResolvedValue({ success: true, meta: { changes: 1 } });
    const db = retryingD1(stubD1(stubStatement({ run })));

    const result = await db.prepare('insert into x values (?)').bind(1).run();

    expect(run).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ success: true, meta: { changes: 1 } });
  });

  it('gives up after the backoff schedule is exhausted', async () => {
    const run = vi.fn().mockRejectedValue(TRANSIENT());
    const db = retryingD1(stubD1(stubStatement({ run })));

    await expect(db.prepare('select 1').run()).rejects.toThrow('Network connection lost');
    expect(run).toHaveBeenCalledTimes(3); // first try + two backoff steps
  });

  it('throws non-transient errors immediately', async () => {
    const run = vi.fn().mockRejectedValue(new Error('D1_ERROR: UNIQUE constraint failed: users.id'));
    const db = retryingD1(stubD1(stubStatement({ run })));

    await expect(db.prepare('insert').run()).rejects.toThrow('UNIQUE constraint failed');
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('recognises a transient fault carried in error.cause', async () => {
    const wrapped = new Error('D1_ERROR: something failed');
    wrapped.cause = new Error('Durable Object storage caused object to be reset.');
    const first = vi.fn().mockRejectedValueOnce(wrapped).mockResolvedValue({ id: 'row' });
    const db = retryingD1(stubD1(stubStatement({ first })));

    await expect(db.prepare('select').first()).resolves.toEqual({ id: 'row' });
    expect(first).toHaveBeenCalledTimes(2);
  });

  it('hands batch() the native statements, not the wrappers', async () => {
    const native = stubStatement();
    const batch = vi.fn().mockResolvedValue([]);
    const d1 = { ...stubD1(native), batch } as unknown as D1Database;
    const db = retryingD1(d1);

    await db.batch([db.prepare('select 1'), db.prepare('select 2')]);

    expect(batch).toHaveBeenCalledWith([native, native]);
  });
});
