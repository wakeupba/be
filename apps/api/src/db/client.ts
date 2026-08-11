import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1';
import { errorFields, logEvent } from '../lib/log';
import * as schema from './schema';

/*
 * Every D1 statement is a network call to the database's single writer, and
 * Cloudflare documents that a small fraction of those calls fail for reasons
 * that are nobody's bug: the connection to the storage node drops, or the
 * Durable Object hosting the database is reset by their own deploys and
 * rebalancing. The advertised remedy is to retry, so the binding handed to
 * drizzle does, once per backoff step, and only for that documented family.
 * Everything else (constraint violations, SQL errors) throws immediately.
 *
 * The trade: a write whose response was lost after committing gets re-sent,
 * which for a non-idempotent insert surfaces as a conflict instead of a
 * success. That needs the failure to land in the sliver between commit and
 * response, is exactly as visible as the error was before, and is dwarfed by
 * the requests this heals, most of which die before anything commits.
 */
const TRANSIENT_MESSAGES = [
  'network connection lost',
  'object to be reset',
  'code was updated',
  'transient issue',
  /* the one that actually hit us (Sentry PROD-3, 2026-08-11): "D1 DB is
   * overloaded. Requests queued for too long." Retrying into an overloaded
   * database is fine at this scale because the retries are bounded and the
   * backoff is exactly the queue-draining time the error is asking for. */
  'overloaded',
];

const BACKOFF_MS = [100, 300];

function isTransientD1Error(error: unknown): boolean {
  // drizzle wraps the D1 error ("Failed query: …" -> "D1_ERROR: …"), so the
  // useful string may sit anywhere down the cause chain
  for (let e = error; e instanceof Error; e = e.cause) {
    const message = e.message.toLowerCase();
    if (TRANSIENT_MESSAGES.some((needle) => message.includes(needle))) return true;
  }
  return false;
}

async function withRetries<T>(op: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await op();
    } catch (error) {
      if (attempt >= BACKOFF_MS.length || !isTransientD1Error(error)) throw error;
      // visible in logs so "how often does D1 flake" is a query, not a guess
      logEvent('warn', 'd1.transient_retry', { attempt: attempt + 1, ...errorFields(error) });
      const { promise, resolve } = Promise.withResolvers<void>();
      setTimeout(resolve, BACKOFF_MS[attempt]);
      await promise;
    }
  }
}

/** the native statement behind a wrapper, because the binding's batch() only
 * accepts statements it created itself */
const NATIVE = Symbol('native-d1-statement');

type WrappedStatement = D1PreparedStatement & { [NATIVE]: D1PreparedStatement };

function wrapStatement(statement: D1PreparedStatement): D1PreparedStatement {
  const wrapped: WrappedStatement = {
    [NATIVE]: statement,
    bind: (...values: unknown[]) => wrapStatement(statement.bind(...values)),
    first: ((column?: string) =>
      withRetries(() =>
        column === undefined ? statement.first() : statement.first(column),
      )) as D1PreparedStatement['first'],
    run: () => withRetries(() => statement.run()),
    all: () => withRetries(() => statement.all()),
    raw: ((options?: { columnNames?: boolean }) =>
      withRetries(() => statement.raw(options as never))) as D1PreparedStatement['raw'],
  };
  return wrapped;
}

/** exported for the retry tests; production callers go through createDb */
export function retryingD1(d1: D1Database): D1Database {
  const wrapped: Pick<D1Database, 'prepare' | 'batch' | 'exec' | 'dump'> = {
    prepare: (query: string) => wrapStatement(d1.prepare(query)),
    batch: <T>(statements: D1PreparedStatement[]) =>
      withRetries(() => d1.batch<T>(statements.map((s) => (s as WrappedStatement)[NATIVE] ?? s))),
    exec: (query: string) => withRetries(() => d1.exec(query)),
    dump: () => d1.dump(),
  };
  return wrapped as D1Database;
}

export function createDb(d1: D1Database) {
  return drizzle(retryingD1(d1), { schema });
}

export type Db = DrizzleD1Database<typeof schema>;
