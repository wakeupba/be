import { eq, lt } from 'drizzle-orm';
import type { Db } from '../db/client';
import { webhookEvents } from '../db/schema';

export class WebhookEventRepo {
  constructor(private readonly db: Db) {}

  /**
   * Claims a webhook delivery for processing. Providers retry with the same
   * id, so a second delivery returns false and the handler must treat the
   * event as already applied.
   */
  async claim(id: string, type: string): Promise<boolean> {
    const result = await this.db
      .insert(webhookEvents)
      .values({ id, type, processedAt: Date.now() })
      .onConflictDoNothing();
    return result.meta.changes > 0;
  }

  /**
   * Releases a claim after processing failed, so the provider's retry is
   * treated as a fresh delivery instead of a duplicate. Without this, a
   * claim followed by a crash would swallow the event forever.
   */
  async release(id: string): Promise<void> {
    await this.db.delete(webhookEvents).where(eq(webhookEvents.id, id));
  }

  /** retries stop within a day; month-old claims are dead weight */
  async deleteOlderThan(cutoffMs: number): Promise<number> {
    const result = await this.db.delete(webhookEvents).where(lt(webhookEvents.processedAt, cutoffMs));
    return result.meta.changes;
  }
}
