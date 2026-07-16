export class VoteRepo {
  constructor(private readonly db: D1Database) {}

  async toggle(featureKey: string, userId: string, note: string | null): Promise<void> {
    const existing = await this.db
      .prepare('SELECT 1 FROM feature_votes WHERE feature_key = ? AND user_id = ?')
      .bind(featureKey, userId)
      .first();
    if (existing) {
      await this.db
        .prepare('DELETE FROM feature_votes WHERE feature_key = ? AND user_id = ?')
        .bind(featureKey, userId)
        .run();
      return;
    }
    await this.db
      .prepare('INSERT INTO feature_votes (feature_key, user_id, note, created_at) VALUES (?, ?, ?, ?)')
      .bind(featureKey, userId, note, Date.now())
      .run();
  }

  async countsWithMine(userId: string): Promise<Map<string, { votes: number; mine: boolean }>> {
    const result = await this.db
      .prepare(
        `SELECT feature_key,
                COUNT(*) AS votes,
                MAX(CASE WHEN user_id = ? THEN 1 ELSE 0 END) AS mine
         FROM feature_votes GROUP BY feature_key`,
      )
      .bind(userId)
      .all<{ feature_key: string; votes: number; mine: number }>();
    const map = new Map<string, { votes: number; mine: boolean }>();
    for (const row of result.results) {
      map.set(row.feature_key, { votes: row.votes, mine: row.mine === 1 });
    }
    return map;
  }
}
