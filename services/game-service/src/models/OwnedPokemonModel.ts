import crypto from 'node:crypto';
import { getDb } from './db.js';
import { applyXp } from '../engine/progression.js';

export interface OwnedPokemonRecord {
  id: string;
  user_id: string;
  name: string;
  level: number;
  /** XP acumulada hacia el siguiente nivel (T6.1). */
  xp: number;
  is_starter: number;
  is_shiny: number;
  acquired_via: string;
  /** Id de la subasta en la que está retenida (escrow); null si está libre. */
  auction_id?: string | null;
  /** Marca de baja por pérdida en Survival (T8.3); null = viva/en inventario. */
  lost_at?: string | null;
  created_at?: string;
}

/** Capa MODELO: Pokémon propios del jugador (inventario). Sin lógica HTTP. */
export const OwnedPokemonModel = {
  async listByUser(userId: string): Promise<OwnedPokemonRecord[]> {
    const db = await getDb();
    // Excluye instancias en subasta (escrow) y las PERDIDAS en Survival (lost_at):
    // no aparecen en inventario ni pueden usarse en equipos.
    return db.all<OwnedPokemonRecord[]>(
      'SELECT * FROM owned_pokemon WHERE user_id = ? AND auction_id IS NULL AND lost_at IS NULL ORDER BY created_at',
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

  /** Evoluciona una instancia a `newForm` (T9.3): cambia la especie conservando id/nivel/XP. */
  async evolve(id: string, newForm: string): Promise<void> {
    const db = await getDb();
    await db.run('UPDATE owned_pokemon SET name = ? WHERE id = ?', newForm.toLowerCase(), id);
  },

  /**
   * Captura un Pokémon SALVAJE (Survival, T8.2): crea una **nueva** instancia para el usuario
   * (no transfiere: los salvajes no tienen instancia previa). Devuelve el id creado.
   */
  async capture(userId: string, name: string, level = 1): Promise<string> {
    const db = await getDb();
    const id = crypto.randomUUID();
    await db.run(
      "INSERT INTO owned_pokemon (id, user_id, name, level, xp, is_starter, is_shiny, acquired_via) VALUES (?, ?, ?, ?, 0, 0, 0, 'capture')",
      id, userId, name, Math.max(1, level)
    );
    return id;
  },

  /** Transfiere una instancia (robo PvP en BR): pasa al ganador. */
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
    return rows.every(
      (r) => r.user_id === userId && (r.auction_id ?? null) === null && (r.lost_at ?? null) === null
    );
  },

  /** Marca una instancia como PERDIDA (Survival, T8.3): soft-delete recuperable. */
  async markLost(id: string): Promise<void> {
    const db = await getDb();
    await db.run("UPDATE owned_pokemon SET lost_at = datetime('now') WHERE id = ? AND lost_at IS NULL", id);
  },

  /** ¿El usuario tiene algún Pokémon perdido recuperable? */
  async hasLost(userId: string): Promise<boolean> {
    const db = await getDb();
    const row = await db.get<{ n: number }>(
      'SELECT COUNT(*) AS n FROM owned_pokemon WHERE user_id = ? AND lost_at IS NOT NULL',
      userId
    );
    return (row?.n ?? 0) > 0;
  },

  /**
   * Recupera el ÚLTIMO Pokémon perdido del usuario (Survival, T8.3): quita `lost_at` y lo
   * devuelve al inventario. Devuelve el registro recuperado, o `null` si no había ninguno.
   */
  async recoverLast(userId: string): Promise<OwnedPokemonRecord | null> {
    const db = await getDb();
    const row = await db.get<OwnedPokemonRecord>(
      'SELECT * FROM owned_pokemon WHERE user_id = ? AND lost_at IS NOT NULL ORDER BY lost_at DESC, rowid DESC LIMIT 1',
      userId
    );
    if (!row) return null;
    await db.run('UPDATE owned_pokemon SET lost_at = NULL WHERE id = ?', row.id);
    return { ...row, lost_at: null };
  },

  /**
   * Otorga `amount` XP a una instancia y persiste el nivel/XP resultantes (subidas en
   * cascada según la curva, T6.1). Devuelve el nuevo estado y cuántos niveles subió, o
   * `null` si la instancia no existe.
   */
  async addXp(id: string, amount: number): Promise<{ level: number; xp: number; levelsGained: number } | null> {
    if (amount <= 0) return null;
    const db = await getDb();
    const rec = await this.findById(id);
    if (!rec) return null;
    const next = applyXp(rec.level, rec.xp ?? 0, amount);
    await db.run('UPDATE owned_pokemon SET level = ?, xp = ? WHERE id = ?', next.level, next.xp, id);
    return next;
  },
};
