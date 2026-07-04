import crypto from 'node:crypto';
import { getDb } from './db.js';

export interface OwnedPokemonRecord {
  id: string;
  user_id: string;
  name: string;
  level: number;
  is_starter: number;
  acquired_via: string;
  created_at?: string;
}

/** Capa MODELO: Pokémon propios del jugador (inventario). Sin lógica HTTP. */
export const OwnedPokemonModel = {
  async listByUser(userId: string): Promise<OwnedPokemonRecord[]> {
    const db = await getDb();
    return db.all<OwnedPokemonRecord[]>(
      'SELECT * FROM owned_pokemon WHERE user_id = ? ORDER BY created_at',
      userId
    );
  },

  async countByUser(userId: string): Promise<number> {
    const db = await getDb();
    const row = await db.get<{ n: number }>(
      'SELECT COUNT(*) AS n FROM owned_pokemon WHERE user_id = ?',
      userId
    );
    return row?.n ?? 0;
  },

  /** Concede varios Pokémon a un usuario (p.ej. los 3 starters). */
  async grantMany(userId: string, names: string[], via = 'starter'): Promise<void> {
    const db = await getDb();
    const isStarter = via === 'starter' ? 1 : 0;
    for (const name of names) {
      await db.run(
        'INSERT INTO owned_pokemon (id, user_id, name, level, is_starter, acquired_via) VALUES (?, ?, ?, 1, ?, ?)',
        crypto.randomUUID(),
        userId,
        name,
        isStarter,
        via
      );
    }
  },

  /** Transfiere una instancia (captura en survival): pasa al ganador. */
  async transfer(id: string, toUserId: string): Promise<void> {
    const db = await getDb();
    await db.run(
      "UPDATE owned_pokemon SET user_id = ?, acquired_via = 'capture', is_starter = 0 WHERE id = ?",
      toUserId,
      id
    );
  },

  async findById(id: string): Promise<OwnedPokemonRecord | undefined> {
    const db = await getDb();
    return db.get<OwnedPokemonRecord>('SELECT * FROM owned_pokemon WHERE id = ?', id);
  },
};
