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

  /** Cantidad que posee el usuario de un objeto concreto (0 si no tiene). */
  async getQty(userId: string, kind: string, itemKey: string): Promise<number> {
    const db = await getDb();
    const row = await db.get<{ qty: number }>(
      'SELECT qty FROM owned_items WHERE user_id = ? AND kind = ? AND item_key = ?',
      userId,
      kind,
      itemKey
    );
    return row?.qty ?? 0;
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

  /**
   * Transfiere `qty` de un objeto de un usuario a otro (regalo). Devuelve false si
   * el emisor no tiene suficiente cantidad. Resta al emisor y suma al receptor.
   */
  async transfer(
    fromUserId: string,
    toUserId: string,
    kind: string,
    itemKey: string,
    qty = 1
  ): Promise<boolean> {
    if (qty <= 0) return false;
    const have = await this.getQty(fromUserId, kind, itemKey);
    if (have < qty) return false;
    await this.add(fromUserId, kind, itemKey, -qty);
    await this.add(toUserId, kind, itemKey, qty);
    return true;
  },
};
