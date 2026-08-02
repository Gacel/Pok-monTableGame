import crypto from 'node:crypto';
import { getDb } from './db.js';

export interface OwnedPokemonRecord {
  id: string;
  user_id: string;
  name: string;
  level: number;
  is_starter: number;
  is_shiny: number;
  acquired_via: string;
  /** Id de la subasta en la que está retenida (escrow); null si está libre. */
  auction_id?: string | null;
  created_at?: string;
}

/** Capa MODELO: Pokémon propios del jugador (inventario). Sin lógica HTTP. */
export const OwnedPokemonModel = {
  async listByUser(userId: string): Promise<OwnedPokemonRecord[]> {
    const db = await getDb();
    // Excluye las instancias en subasta (escrow): no aparecen en inventario ni
    // pueden usarse en equipos mientras están a la venta.
    return db.all<OwnedPokemonRecord[]>(
      'SELECT * FROM owned_pokemon WHERE user_id = ? AND auction_id IS NULL ORDER BY created_at',
      userId
    );
  },

  /** Marca (o libera) una instancia como escrow de una subasta. */
  async setAuction(id: string, auctionId: string | null): Promise<void> {
    const db = await getDb();
    await db.run('UPDATE owned_pokemon SET auction_id = ? WHERE id = ?', auctionId, id);
  },

  /** Vende la instancia al comprador: cambia dueño y libera el escrow. */
  async transferSold(id: string, toUserId: string): Promise<void> {
    const db = await getDb();
    await db.run(
      "UPDATE owned_pokemon SET user_id = ?, auction_id = NULL, acquired_via = 'auction', is_starter = 0 WHERE id = ?",
      toUserId,
      id
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
  async grantMany(userId: string, names: string[], via = 'starter', isShiny = false): Promise<void> {
    const db = await getDb();
    const isStarter = via === 'starter' ? 1 : 0;
    const isShinyInt = isShiny ? 1 : 0;
    for (const name of names) {
      await db.run(
        'INSERT INTO owned_pokemon (id, user_id, name, level, is_starter, is_shiny, acquired_via) VALUES (?, ?, ?, 1, ?, ?, ?)',
        crypto.randomUUID(),
        userId,
        name,
        isStarter,
        isShinyInt,
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

  /** Regala una instancia a otro usuario (transferencia directa entre amigos). */
  async gift(id: string, toUserId: string): Promise<void> {
    const db = await getDb();
    await db.run(
      "UPDATE owned_pokemon SET user_id = ?, acquired_via = 'gift', is_starter = 0 WHERE id = ?",
      toUserId,
      id
    );
  },

  async findById(id: string): Promise<OwnedPokemonRecord | undefined> {
    const db = await getDb();
    return db.get<OwnedPokemonRecord>('SELECT * FROM owned_pokemon WHERE id = ?', id);
  },

  /**
   * Carga varias instancias por id **conservando el orden** de `ids`. Omite las que no
   * existan. Para construir un equipo por instancia (T6.3) desde los `ownedId` elegidos.
   */
  async findManyByIds(ids: string[]): Promise<OwnedPokemonRecord[]> {
    if (ids.length === 0) return [];
    const db = await getDb();
    const placeholders = ids.map(() => '?').join(',');
    const rows = await db.all<OwnedPokemonRecord[]>(
      `SELECT * FROM owned_pokemon WHERE id IN (${placeholders})`,
      ...ids
    );
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids.map((id) => byId.get(id)).filter((r): r is OwnedPokemonRecord => !!r);
  },

  /**
   * ¿Son TODOS estos ids instancias libres (no en subasta) del usuario? Validación de
   * propiedad autoritativa para armar equipos por `ownedId` (T6.3).
   */
  async allOwnedBy(userId: string, ids: string[]): Promise<boolean> {
    if (ids.length === 0) return false;
    const rows = await this.findManyByIds(ids);
    if (rows.length !== ids.length) return false;
    return rows.every((r) => r.user_id === userId && (r.auction_id ?? null) === null);
  },
};
