import { PokemonModel, PokemonTemplate } from '../models/PokemonModel.js';
import { MovementPattern, PokemonType } from '../engine/board.js';

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

function typeFromPokeApi(primaryType: string): PokemonType {
  const t = primaryType.toUpperCase();
  const valid: PokemonType[] = [
    'FIRE', 'WATER', 'GRASS', 'POISON', 'FLYING', 'DRAGON', 'PSYCHIC', 'NORMAL', 'ELECTRIC', 'ICE', 'FAIRY'
  ];
  if (valid.includes(t as PokemonType)) return t as PokemonType;
  if (['ROCK', 'GROUND', 'FIGHTING'].includes(t)) return 'NORMAL';
  if (['BUG'].includes(t)) return 'GRASS';
  if (['GHOST', 'DARK'].includes(t)) return 'POISON';
  if (['STEEL'].includes(t)) return 'ELECTRIC';
  return 'NORMAL';
}

function patternFromType(type: PokemonType): MovementPattern {
  if (['FIRE', 'FLYING', 'DRAGON', 'PSYCHIC'].includes(type)) return 'FLYING';
  if (['GRASS', 'ELECTRIC', 'FAIRY'].includes(type)) return 'SPEEDSTER';
  return 'TANK'; // WATER, POISON, NORMAL, ICE
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

      const type = typeFromPokeApi(data.types?.[0]?.type?.name ?? 'grass');
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
