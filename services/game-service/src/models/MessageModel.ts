import { getDb } from './db.js';

export interface DmMessage {
  id: number;
  dm_room: string;
  from_id: string;
  text: string;
  created_at: string;
}

/** Capa MODELO: mensajes de chat directo (DM) persistentes. */
export const MessageModel = {
  async add(room: string, fromId: string, text: string): Promise<DmMessage> {
    const db = await getDb();
    const res = await db.run(
      'INSERT INTO messages (dm_room, from_id, text) VALUES (?, ?, ?)',
      room,
      fromId,
      text
    );
    const row = await db.get<DmMessage>('SELECT * FROM messages WHERE id = ?', res.lastID);
    return row!;
  },

  /** Últimos `limit` mensajes de la sala, en orden cronológico ascendente. */
  async history(room: string, limit = 50): Promise<DmMessage[]> {
    const db = await getDb();
    const rows = await db.all<DmMessage[]>(
      'SELECT * FROM messages WHERE dm_room = ? ORDER BY id DESC LIMIT ?',
      room,
      limit
    );
    return rows.reverse();
  },
};
