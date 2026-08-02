import { getDb } from './db.js';
import type { EvolutionInfo } from '../engine/evolution.js';

/** Fila de la tabla `evolutions`. `evolvesTo === null` = forma final (cacheado). */
export interface EvolutionRow {
  name: string;
  info: EvolutionInfo | null;
}

export const EvolutionModel = {
  /** Devuelve la evolución cacheada. `undefined` = no consultada aún; `{info:null}` = sin evolución. */
  async find(name: string): Promise<EvolutionRow | undefined> {
    const db = await getDb();
    const row = await db.get(
      'SELECT name, evolves_to AS evolvesTo, trigger, min_level AS minLevel, item FROM evolutions WHERE name = ?',
      name.toLowerCase()
    );
    if (!row) return undefined;
    if (!row.evolvesTo) return { name: row.name, info: null };
    const info: EvolutionInfo = { evolvesTo: row.evolvesTo, trigger: row.trigger };
    if (row.minLevel != null) info.minLevel = row.minLevel;
    if (row.item != null) info.item = row.item;
    return { name: row.name, info };
  },

  async save(name: string, info: EvolutionInfo | null): Promise<void> {
    const db = await getDb();
    await db.run(
      `INSERT OR REPLACE INTO evolutions (name, evolves_to, trigger, min_level, item)
       VALUES (?, ?, ?, ?, ?)`,
      name.toLowerCase(),
      info?.evolvesTo ?? null,
      info?.trigger ?? null,
      info?.minLevel ?? null,
      info?.item ?? null
    );
  },
};
