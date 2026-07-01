import { getDb } from './db.js';
import type { GameMode, MatchMode, PlayerSlot } from '@transcendence/shared';

export interface MatchRow {
  id: string;
  status: string;
  turn: number;
  current_player: string | null;
  winner: string | null;
}

/** Fila completa de una sala/partida del lobby (columnas extra de `matches`). */
export interface RoomRow extends MatchRow {
  name: string | null;
  mode: MatchMode;
  game_mode: GameMode;
  capacity: number;
  host_id: string | null;
  players_json: string | null;
  created_at: string;
  updated_at: string;
}

/** Jugador dentro de una sala, tal y como se persiste en `players_json`. */
export interface StoredRoomPlayer {
  userId: string;
  username: string;
  slot: PlayerSlot;
  /** Equipo del draft (3 nombres) o null si aún no lo envió. */
  team: string[] | null;
}

export function parseRoomPlayers(row: RoomRow): StoredRoomPlayer[] {
  if (!row.players_json) return [];
  try {
    return JSON.parse(row.players_json) as StoredRoomPlayer[];
  } catch {
    return [];
  }
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

  // ------------------------------------------------------------ lobby (salas)

  /** Crea una sala online en estado `waiting` con el anfitrión dentro. */
  async createRoom(
    id: string,
    name: string,
    gameMode: GameMode,
    capacity: number,
    hostId: string,
    players: StoredRoomPlayer[]
  ): Promise<void> {
    const db = await getDb();
    await db.run(
      `INSERT INTO matches (id, status, turn, current_player, winner, name, mode, game_mode, capacity, host_id, players_json)
       VALUES (?, 'waiting', 0, NULL, NULL, ?, 'online', ?, ?, ?, ?)`,
      id,
      name,
      gameMode,
      capacity,
      hostId,
      JSON.stringify(players)
    );
  },

  async findRoom(id: string): Promise<RoomRow | undefined> {
    const db = await getDb();
    return db.get<RoomRow>('SELECT * FROM matches WHERE id = ?', id);
  },

  /** Salas online abiertas (esperando jugadores), la más nueva primero. */
  async listOpenRooms(): Promise<RoomRow[]> {
    const db = await getDb();
    return db.all<RoomRow[]>(
      `SELECT * FROM matches
       WHERE mode = 'online' AND status = 'waiting'
       ORDER BY created_at DESC`
    );
  },

  async updateRoomPlayers(id: string, players: StoredRoomPlayer[]): Promise<void> {
    const db = await getDb();
    await db.run(
      `UPDATE matches SET players_json = ?, updated_at = datetime('now') WHERE id = ?`,
      JSON.stringify(players),
      id
    );
  },

  async updateRoomStatus(id: string, status: string): Promise<void> {
    const db = await getDb();
    await db.run(
      `UPDATE matches SET status = ?, updated_at = datetime('now') WHERE id = ?`,
      status,
      id
    );
  },

  async deleteRoom(id: string): Promise<void> {
    const db = await getDb();
    await db.run('DELETE FROM matches WHERE id = ?', id);
  },

  /** Borra salas `waiting` sin actividad (limpieza perezosa del lobby). */
  async sweepStaleRooms(maxAgeMinutes: number): Promise<void> {
    const db = await getDb();
    await db.run(
      `DELETE FROM matches
       WHERE mode = 'online' AND status = 'waiting'
         AND updated_at < datetime('now', ?)`,
      `-${Math.floor(maxAgeMinutes)} minutes`
    );
  },
};
