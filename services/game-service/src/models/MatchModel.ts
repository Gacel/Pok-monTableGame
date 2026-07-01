import { getDb } from './db.js';

export interface MatchRow {
  id: string;
  status: string;
  turn: number;
  current_player: string | null;
  winner: string | null;
}

/** Capa MODELO: persistencia de partidas y su estado serializado (JSON). */
export const MatchModel = {
  async upsert(row: MatchRow, stateJson: string): Promise<void> {
    const db = await getDb();
    await db.run(
      `INSERT INTO matches (id, status, turn, current_player, winner, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         status = excluded.status,
         turn = excluded.turn,
         current_player = excluded.current_player,
         winner = excluded.winner,
         updated_at = datetime('now')`,
      row.id,
      row.status,
      row.turn,
      row.current_player,
      row.winner
    );
    await db.run(
      `INSERT INTO match_state (match_id, state_json) VALUES (?, ?)
       ON CONFLICT(match_id) DO UPDATE SET state_json = excluded.state_json`,
      row.id,
      stateJson
    );
  },

  async loadState(id: string): Promise<string | undefined> {
    const db = await getDb();
    const row = await db.get<{ state_json: string }>(
      'SELECT state_json FROM match_state WHERE match_id = ?',
      id
    );
    return row?.state_json;
  },

  async find(id: string): Promise<MatchRow | undefined> {
    const db = await getDb();
    return db.get<MatchRow>('SELECT * FROM matches WHERE id = ?', id);
  },
};
