import { getDb } from './db.js';
import { MovementPattern, PokemonType } from '../engine/board.js';

export interface PokemonTemplate {
  name: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  type: PokemonType;
  movementPattern: MovementPattern;
}

/** Capa MODELO: caché de plantillas de Pokémon (datos derivados de PokeAPI). */
export const PokemonModel = {
  async findByName(name: string): Promise<PokemonTemplate | undefined> {
    const db = await getDb();
    const row = await db.get(
      'SELECT name, hp, maxHp, atk, def, type, movementPattern FROM pokemons WHERE name = ?',
      name
    );
    if (!row) return undefined;
    return row as PokemonTemplate;
  },

  async save(tpl: PokemonTemplate, rawData?: unknown): Promise<void> {
    const db = await getDb();
    await db.run(
      `INSERT OR REPLACE INTO pokemons (name, hp, maxHp, atk, def, type, movementPattern, raw_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      tpl.name,
      tpl.hp,
      tpl.maxHp,
      tpl.atk,
      tpl.def,
      tpl.type,
      tpl.movementPattern,
      rawData ? JSON.stringify(rawData) : null
    );
  },
};
