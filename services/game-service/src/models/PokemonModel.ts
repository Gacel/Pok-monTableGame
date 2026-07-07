import { getDb } from './db.js';
import { PokemonType } from '../engine/board.js';

export interface PokemonTemplate {
  name: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  type: PokemonType;
  speed: number;
  size: 'small' | 'medium' | 'large';
}

/** Capa MODELO: caché de plantillas de Pokémon (datos derivados de PokeAPI). */
export const PokemonModel = {
  async findByName(name: string): Promise<PokemonTemplate | undefined> {
    const db = await getDb();
    const row = await db.get(
      'SELECT name, hp, maxHp, atk, def, type, speed, size FROM pokemons WHERE name = ?',
      name
    );
    if (!row) return undefined;
    return row as PokemonTemplate;
  },

  async save(tpl: PokemonTemplate, rawData?: unknown): Promise<void> {
    const db = await getDb();
    await db.run(
      `INSERT OR REPLACE INTO pokemons (name, hp, maxHp, atk, def, type, speed, size, raw_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      tpl.name,
      tpl.hp,
      tpl.maxHp,
      tpl.atk,
      tpl.def,
      tpl.type,
      tpl.speed,
      tpl.size,
      rawData ? JSON.stringify(rawData) : null
    );
  },
};
