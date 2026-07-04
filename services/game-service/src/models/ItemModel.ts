import { getDb } from './db.js';

export interface OwnedItemRecord {
  user_id: string;
  kind: string; // 'cosmetic' | 'pokeball' | ...
  item_key: string; // p.ej. 'poke-ball', 'great-ball', 'skin-red'
  qty: number;
  created_at?: string;
}

/** Capa MODELO: objetos del jugador (cosméticos, pokéballs...). */
export const ItemModel = {
  async listByUser(userId: string): Promise<OwnedItemRecord[]> {
    const db = await getDb();
    return db.all<OwnedItemRecord[]>(
      'SELECT * FROM owned_items WHERE user_id = ? ORDER BY kind, item_key',
      userId
    );
  },

  /** Suma `qty` de un objeto (upsert por (user, kind, item_key)). */
  async add(userId: string, kind: string, itemKey: string, qty = 1): Promise<void> {
    const db = await getDb();
    await db.run(
      `INSERT INTO owned_items (user_id, kind, item_key, qty) VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, kind, item_key) DO UPDATE SET qty = qty + excluded.qty`,
      userId,
      kind,
      itemKey,
      qty
    );
  },
};
