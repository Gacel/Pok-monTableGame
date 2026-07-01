import { getDb } from './db.js';
import { MoveDamageClass, PokemonType } from '../engine/board.js';

/** Fila del catálogo de movimientos (datos derivados de PokeAPI). */
export interface MoveRow {
  name: string;
  type: PokemonType;
  power: number | null;
  accuracy: number | null;
  pp: number | null;
  damageClass: MoveDamageClass | null;
  shortEffect: string | null;
}

/** Entrada del learnset de un Pokémon. */
export interface LearnsetEntry {
  moveName: string;
  learnMethod: string | null;
  level: number;
}

/** Capa MODELO: catálogo de movimientos + learnset por Pokémon. */
export const MoveModel = {
  async findMove(name: string): Promise<MoveRow | undefined> {
    const db = await getDb();
    const row = await db.get(
      `SELECT name, type, power, accuracy, pp, damage_class AS damageClass, short_effect AS shortEffect
       FROM moves WHERE name = ?`,
      name
    );
    return row as MoveRow | undefined;
  },

  async saveMove(row: MoveRow, rawData?: unknown): Promise<void> {
    const db = await getDb();
    await db.run(
      `INSERT OR REPLACE INTO moves (name, type, power, accuracy, pp, damage_class, short_effect, raw_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      row.name,
      row.type,
      row.power,
      row.accuracy,
      row.pp,
      row.damageClass,
      row.shortEffect,
      rawData ? JSON.stringify(rawData) : null
    );
  },

  async hasLearnset(pokemonName: string): Promise<boolean> {
    const db = await getDb();
    const row = await db.get(
      `SELECT 1 AS present FROM pokemon_moves WHERE pokemon_name = ? LIMIT 1`,
      pokemonName
    );
    return !!row;
  },

  async listLearnset(pokemonName: string): Promise<LearnsetEntry[]> {
    const db = await getDb();
    const rows = await db.all(
      `SELECT move_name AS moveName, learn_method AS learnMethod, level
       FROM pokemon_moves WHERE pokemon_name = ? ORDER BY level ASC, move_name ASC`,
      pokemonName
    );
    return rows as LearnsetEntry[];
  },

  /** Inserta el learnset completo (idempotente: ignora duplicados). */
  async saveLearnset(pokemonName: string, entries: LearnsetEntry[]): Promise<void> {
    const db = await getDb();
    const stmt = await db.prepare(
      `INSERT OR IGNORE INTO pokemon_moves (pokemon_name, move_name, learn_method, level)
       VALUES (?, ?, ?, ?)`
    );
    try {
      for (const e of entries) {
        await stmt.run(pokemonName, e.moveName, e.learnMethod, e.level);
      }
    } finally {
      await stmt.finalize();
    }
  },
};
