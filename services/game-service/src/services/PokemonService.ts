import { PokemonModel, PokemonTemplate } from '../models/PokemonModel.js';
import { Biome, MovementPattern } from '../engine/board.js';

interface PokeApiStat {
  base_stat: number;
  stat: { name: string };
}
interface PokeApiType {
  type: { name: string };
}
interface PokeApiResponse {
  stats: PokeApiStat[];
  types: PokeApiType[];
}

function statOf(data: PokeApiResponse, name: string, fallback: number): number {
  return data.stats.find((s) => s.stat.name === name)?.base_stat ?? fallback;
}

function biomeFromType(primaryType: string): Biome {
  const t = primaryType.toUpperCase();
  if (t === 'FIRE' || t === 'WATER' || t === 'GRASS') return t as Biome;
  // Mapear tipos comunes a nuestros tres biomas de combate.
  if (['ICE'].includes(t)) return 'WATER';
  if (['ROCK', 'GROUND'].includes(t)) return 'FIRE';
  return 'GRASS';
}

function patternFromType(type: Biome): MovementPattern {
  if (type === 'FIRE') return 'FLYING';
  if (type === 'GRASS') return 'SPEEDSTER';
  return 'TANK';
}

/**
 * Capa SERVICIO: obtiene plantillas de Pokémon con caché-primero (SQLite),
 * cayendo a PokeAPI cuando no existen. Devuelve datos ya normalizados al dominio.
 */
export const PokemonService = {
  async getTemplate(name: string): Promise<PokemonTemplate> {
    const cached = await PokemonModel.findByName(name);
    if (cached) return cached;

    try {
      const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${name.toLowerCase()}`);
      if (!res.ok) throw new Error(`PokeAPI ${res.status}`);
      const data = (await res.json()) as PokeApiResponse;

      const type = biomeFromType(data.types?.[0]?.type?.name ?? 'grass');
      const hp = statOf(data, 'hp', 100) * 2; // escalado para gameplay
      const atk = statOf(data, 'attack', 50);
      const def = statOf(data, 'defense', 40);

      const tpl: PokemonTemplate = {
        name,
        hp,
        maxHp: hp,
        atk,
        def,
        type,
        movementPattern: patternFromType(type),
      };
      await PokemonModel.save(tpl, data);
      return tpl;
    } catch {
      // Fallback determinista si PokeAPI no está disponible.
      const tpl: PokemonTemplate = {
        name,
        hp: 200,
        maxHp: 200,
        atk: 50,
        def: 40,
        type: 'GRASS',
        movementPattern: 'TANK',
      };
      await PokemonModel.save(tpl);
      return tpl;
    }
  },
};
