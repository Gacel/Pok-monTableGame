/**
 * Contratos de DOMINIO compartidos entre game-service y frontend.
 * ÚNICA fuente de verdad: el backend (engine/board.ts, engine/hex.ts) y el
 * frontend (models/Types.ts) re-exportan desde aquí. No dupliques estos tipos.
 *
 * Convención de casing: MAYÚSCULAS para los enums de dominio (es lo que persiste
 * la BD y produce el motor). No introducir variantes en minúsculas.
 */
import type { BallKey } from './balls.js';

/** Coordenada axial de una casilla hexagonal. */
export interface Hex {
  q: number;
  r: number;
}

/** Biomas del tablero (lógica Catan). */
export const BIOMES = ['FIRE', 'WATER', 'GRASS', 'SAND', 'ICE', 'MOUNTAIN', 'TALL_GRASS', 'SWAMP'] as const;
export type Biome = (typeof BIOMES)[number];

/** Tipos de Pokémon (afectan a la ventaja de tipo en combate). */
export const POKEMON_TYPES = [
  'FIRE', 'WATER', 'GRASS', 'POISON', 'FLYING',
  'DRAGON', 'PSYCHIC', 'NORMAL', 'ELECTRIC', 'ICE', 'FAIRY',
  'BUG', 'ROCK', 'FIGHTING', 'GHOST', 'GROUND', 'STEEL',
] as const;
export type PokemonType = (typeof POKEMON_TYPES)[number];

/** Tamaños de Pokémon (dicta si bloquean visión y casillas ocupadas). */
export const POKEMON_SIZES = ['small', 'medium', 'large'] as const;
export type PokemonSize = (typeof POKEMON_SIZES)[number];

/** Área de efecto de un ataque. */
export type AreaOfEffect = 'single' | 'line' | 'cone' | 'radius';

/** Categoría PokeAPI del movimiento. */
export type MoveDamageClass = 'physical' | 'special' | 'status';

/** Un ataque concreto de un Pokémon (importado de PokeAPI y curado para combate). */
export interface PokemonMove {
  /** Identificador/nombre del movimiento (ej. 'ember'); se muestra y se valida por él. */
  name: string;
  /** Nombre a mostrar en la interfaz, en el idioma del usuario (ej. 'Ascuas'). */
  displayName?: string;
  /** Tipo del movimiento, ya normalizado al dominio (afecta a la ventaja de tipo). */
  type: PokemonType;
  /** Potencia base (0 si no inflige daño directo). */
  power: number;
  /** Categoría: física (gratis) / especial (cuesta 1 candy) / estado. */
  damageClass: MoveDamageClass;
  /** Precisión 0-100 (informativo). */
  accuracy?: number;
  /** Puntos de poder (informativo). */
  pp?: number;
  /** Rango máximo en hexágonos para lanzar el ataque. */
  range?: number;
  /** Forma del área de efecto. */
  aoe?: AreaOfEffect;
}

export interface Pokemon {
  id: string;
  playerId: string;
  name?: string;
  type: PokemonType;
  speed: number;
  size: PokemonSize;
  hp: number;
  maxHp: number;
  /** Ataque base (por defecto 50 si no se especifica). */
  atk?: number;
  /** Defensa base (por defecto 40 si no se especifica). */
  def?: number;
  /** Nivel de combate; usado como umbral para evolución. */
  level?: number;
  /** Orientación horizontal en el tablero. */
  facing?: 'left' | 'right';
  /** Turnos consecutivos en terreno de lava (FIRE). */
  lavaTurns?: number;
  /** Si ya realizó su acción de movimiento o ataque en el turno actual. */
  hasActed?: boolean;
  /** Si el Pokémon está oculto en la hierba alta. */
  isHidden?: boolean;
  /** Ataques curados (≤4) disponibles en la fase de combate. */
  moves?: PokemonMove[];
  /** Bola que transporta este Pokémon (recogida de un cofre/suelo). La suelta si es KO. */
  carriedBall?: BallKey;
}

export interface Tile {
  hex: Hex;
  biome: Biome;
  occupant: Pokemon | null;
  /** Cofre de botín en esta casilla (el primer Pokémon que llega se lleva la bola). */
  chest?: boolean;
  /** Bola caída en el suelo (de un portador KO); recogible al pisar la casilla. */
  groundBall?: BallKey;
}

/** Recursos (candies) por jugador. */
export interface PlayerResources {
  FIRE_CANDY: number;
  WATER_CANDY: number;
  GRASS_CANDY: number;
}

/** Opciones de movimiento/ataque calculadas para una pieza. */
export interface MoveOptions {
  moves: Hex[];
  attacks: Hex[];
}

/**
 * Multiplicador de ataque por ventaja de tipo (rueda clásica). ÚNICA fuente:
 * la usan el motor de combate (servidor) y la IA del cliente. 1.5 super efectivo,
 * 0.5 poco efectivo, 1.0 neutro.
 */
export function typeAdvantage(attacker: string, defender: string): number {
  const beats: Record<string, string[]> = {
    FIRE: ['GRASS', 'ICE'],
    WATER: ['FIRE'],
    GRASS: ['WATER'],
    ELECTRIC: ['WATER', 'FLYING'],
    ICE: ['GRASS', 'FLYING', 'DRAGON'],
    POISON: ['GRASS', 'FAIRY'],
    FLYING: ['GRASS'],
    PSYCHIC: ['POISON'],
    DRAGON: ['DRAGON'],
    FAIRY: ['DRAGON'],
  };
  if (beats[attacker]?.includes(defender)) return 1.5;
  if (beats[defender]?.includes(attacker)) return 0.5;
  return 1.0;
}
