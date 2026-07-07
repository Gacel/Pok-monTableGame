import { PokemonModel, PokemonTemplate } from '../models/PokemonModel.js';
import { MoveModel, MoveRow } from '../models/MoveModel.js';
import { PokemonMove, PokemonType } from '../engine/board.js';

interface PokeApiStat {
  base_stat: number;
  stat: { name: string };
}
interface PokeApiType {
  type: { name: string };
}
interface PokeApiMoveEntry {
  move: { name: string };
  version_group_details?: {
    level_learned_at?: number;
    move_learn_method?: { name?: string };
  }[];
}
interface PokeApiResponse {
  stats: PokeApiStat[];
  types: PokeApiType[];
  moves?: PokeApiMoveEntry[];
}
interface PokeApiMove {
  power?: number | null;
  accuracy?: number | null;
  pp?: number | null;
  type?: { name?: string };
  damage_class?: { name?: string };
  effect_entries?: { short_effect?: string; language?: { name?: string } }[];
  target?: { name?: string };
  names?: { name: string; language: { name: string } }[];
}

/** Nº de movimientos del learnset que consideramos para curar (acota los fetch). */
const CANDIDATE_CAP = 14;
/** Ataques mostrados en la fase de combate. */
const CURATED_COUNT = 4;
/** Timeout por petición a PokeAPI (evita colgar el arranque si la API va lenta). */
const FETCH_TIMEOUT_MS = 7000;

async function fetchJson<T>(url: string): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`PokeAPI ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
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



function fallbackMove(type: PokemonType): PokemonMove {
  return { name: 'golpe', type, power: 45, damageClass: 'physical', accuracy: 100, pp: 35, range: 1, aoe: 'single' };
}

/** Extrae el learnset de la respuesta de PokeAPI (nombre + método/nivel principal). */
function learnsetFrom(data: PokeApiResponse) {
  return (data.moves ?? []).map((m) => {
    const details = m.version_group_details ?? [];
    const levelUp = details.find((v) => v.move_learn_method?.name === 'level-up');
    const chosen = levelUp ?? details[0];
    return {
      moveName: m.move.name,
      learnMethod: chosen?.move_learn_method?.name ?? null,
      level: chosen?.level_learned_at ?? 0,
    };
  });
}

/**
 * Capa SERVICIO: obtiene plantillas de Pokémon con caché-primero (SQLite),
 * cayendo a PokeAPI cuando no existen. Además importa el learnset completo y
 * cura los ataques usados en la fase de combate. Devuelve datos normalizados.
 */
export const PokemonService = {
  async getTemplate(name: string): Promise<PokemonTemplate> {
    const cached = await PokemonModel.findByName(name);
    if (cached) return cached;

    try {
      const data = await fetchJson<PokeApiResponse>(
        `https://pokeapi.co/api/v2/pokemon/${name.toLowerCase()}`
      );

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
        speed: Math.max(2, Math.floor(statOf(data, 'speed', 60) / 20)),
        size: 'medium',
      };
      await PokemonModel.save(tpl, data);
      // Importa el learnset completo (barato: viene en la misma respuesta).
      await MoveModel.saveLearnset(name, learnsetFrom(data));
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
        speed: 3,
        size: 'medium',
      };
      await PokemonModel.save(tpl);
      return tpl;
    }
  },

  /** Hidrata (y cachea) los detalles de un movimiento desde PokeAPI. */
  async hydrateMove(name: string): Promise<MoveRow | null> {
    const existing = await MoveModel.findMove(name);
    if (existing) return existing;
    try {
      const data = await fetchJson<PokeApiMove>(`https://pokeapi.co/api/v2/move/${name}`);
      const row: MoveRow = {
        name,
        type: typeFromPokeApi(data.type?.name ?? 'normal'),
        power: data.power ?? null,
        accuracy: data.accuracy ?? null,
        pp: data.pp ?? null,
        damageClass: (data.damage_class?.name as MoveRow['damageClass']) ?? null,
        shortEffect:
          data.effect_entries?.find((e) => e.language?.name === 'en')?.short_effect ?? null,
        target: data.target?.name ?? null,
        displayName: data.names?.find((n) => n.language?.name === 'es')?.name ?? null,
      };
      await MoveModel.saveMove(row, data);
      return row;
    } catch {
      return null;
    }
  },

  /**
   * Devuelve hasta 4 ataques curados para la fase de combate:
   * prioriza movimientos de nivel/MT con daño, favorece el STAB (mismo tipo)
   * y garantiza al menos un ataque físico (gratuito). Todo cacheado en SQLite.
   */
  async getCuratedMoves(name: string, pokeType: PokemonType): Promise<PokemonMove[]> {
    try {
      if (!(await MoveModel.hasLearnset(name))) {
        const data = await fetchJson<PokeApiResponse>(
          `https://pokeapi.co/api/v2/pokemon/${name.toLowerCase()}`
        );
        await MoveModel.saveLearnset(name, learnsetFrom(data));
      }

      const learnset = await MoveModel.listLearnset(name);
      const prioritized = [
        ...learnset.filter((l) => l.learnMethod === 'level-up'),
        ...learnset.filter((l) => l.learnMethod === 'machine'),
        ...learnset.filter((l) => l.learnMethod !== 'level-up' && l.learnMethod !== 'machine'),
      ].slice(0, CANDIDATE_CAP);

      const details = (await Promise.all(prioritized.map((c) => this.hydrateMove(c.moveName))))
        .filter((m): m is MoveRow => !!m)
        .filter((m) => (m.power ?? 0) > 0);

      const sorted = details.sort((a, b) => {
        const stabA = a.type === pokeType ? 1 : 0;
        const stabB = b.type === pokeType ? 1 : 0;
        if (stabB !== stabA) return stabB - stabA;
        return (b.power ?? 0) - (a.power ?? 0);
      });

      const toMove = (m: MoveRow): PokemonMove => {
        const mv: PokemonMove = {
          name: m.name,
          type: m.type,
          power: m.power ?? 0,
          damageClass: (m.damageClass ?? 'physical') as PokemonMove['damageClass'],
          range: 1,
          aoe: 'single',
        };
        if (m.displayName != null) mv.displayName = m.displayName;
        if (m.accuracy != null) mv.accuracy = m.accuracy;
        if (m.pp != null) mv.pp = m.pp;
        
        // Mapeo rudimentario de targets de PokeAPI a geometría AoE
        const target = m.target ?? 'selected-pokemon';
        if (target === 'all-other-pokemon' || target === 'all-pokemon') {
          mv.aoe = 'radius';
          mv.range = 0; // se castea sobre uno mismo y afecta al radio
        } else if (target === 'all-opponents') {
          mv.aoe = 'cone';
          mv.range = 2; // un cono de tamaño 2
        } else if (m.damageClass === 'special') {
          // ataques especiales (proyectiles) suelen tener rango
          mv.range = 3;
          // Si es muy potente, puede ser línea o cono
          if (mv.power >= 90) mv.aoe = 'line';
        }
        
        return mv;
      };

      const picked: PokemonMove[] = [];
      const seen = new Set<string>();
      for (const m of sorted) {
        if (picked.length >= CURATED_COUNT) break;
        if (seen.has(m.name)) continue;
        seen.add(m.name);
        picked.push(toMove(m));
      }

      // Garantiza al menos un ataque físico gratuito.
      if (!picked.some((m) => m.damageClass === 'physical')) {
        if (picked.length >= CURATED_COUNT) picked.pop();
        picked.unshift(fallbackMove(pokeType));
      }

      return picked.length > 0 ? picked : [fallbackMove(pokeType)];
    } catch {
      return [fallbackMove(pokeType)];
    }
  },
};
