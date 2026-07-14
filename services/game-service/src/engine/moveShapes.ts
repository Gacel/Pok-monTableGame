import type { AreaOfEffect } from '@transcendence/shared';

/** Forma y alcance de un ataque en el tablero. */
export interface MoveShape {
  /** Alcance máximo del centro del AoE (hexes). 0 = autocentrado (sobre uno mismo). */
  range: number;
  aoe: AreaOfEffect;
  /** Radio del AoE radial (solo `aoe:'radius'`). */
  radius?: number;
}

/** Subconjunto de un move necesario para clasificar su forma (subset de MoveRow). */
export interface MoveShapeInput {
  name: string;
  target?: string | null;
  damageClass?: string | null;
  power?: number | null;
}

/**
 * Lista curada (D5): forma/alcance de moves emblemáticos o relevantes de Gen 1 cuya forma
 * por defecto no sería correcta. Nombres = slug de PokeAPI. Extensible; el resto de moves
 * los resuelve el clasificador por defecto de `getMoveShape`.
 */
export const MOVE_SHAPES: Record<string, MoveShape> = {
  // --- Ondas radiales autocentradas (range 0 = solo sobre uno mismo; radius = alcance) ---
  earthquake: { aoe: 'radius', range: 0, radius: 2 },
  magnitude: { aoe: 'radius', range: 0, radius: 2 },
  bulldoze: { aoe: 'radius', range: 0, radius: 1 },
  explosion: { aoe: 'radius', range: 0, radius: 3 },
  'self-destruct': { aoe: 'radius', range: 0, radius: 2 },
  discharge: { aoe: 'radius', range: 0, radius: 1 },
  'lava-plume': { aoe: 'radius', range: 0, radius: 1 },
  surf: { aoe: 'radius', range: 0, radius: 2 },

  // --- Rayos / chorros en línea (rango = longitud del rayo) ---
  'hyper-beam': { aoe: 'line', range: 4 },
  'solar-beam': { aoe: 'line', range: 4 },
  'hydro-pump': { aoe: 'line', range: 4 },
  flamethrower: { aoe: 'line', range: 3 },
  'ice-beam': { aoe: 'line', range: 3 },
  psybeam: { aoe: 'line', range: 3 },
  'aurora-beam': { aoe: 'line', range: 3 },

  // --- Conos (barridos / vendavales) ---
  'razor-wind': { aoe: 'cone', range: 3 },
  'heat-wave': { aoe: 'cone', range: 2 },
  twister: { aoe: 'cone', range: 2 },

  // --- Proyectiles físicos a distancia (evitan el range 1 melee por defecto) ---
  'rock-throw': { aoe: 'single', range: 2 },
  'rock-slide': { aoe: 'radius', range: 2, radius: 1 },
  'bone-club': { aoe: 'single', range: 2 },
  bonemerang: { aoe: 'single', range: 3 },
  'egg-bomb': { aoe: 'single', range: 2 },
};

/**
 * Forma/alcance de un move: primero la lista curada; si no está, un clasificador por
 * defecto a partir de `target` (PokeAPI) + `damageClass`.
 */
export function getMoveShape(m: MoveShapeInput): MoveShape {
  const curated = MOVE_SHAPES[m.name];
  if (curated) return curated;

  const target = m.target ?? 'selected-pokemon';
  if (target === 'all-other-pokemon' || target === 'all-pokemon') {
    return { aoe: 'radius', range: 0, radius: 1 }; // onda autocentrada pequeña
  }
  if (target === 'all-opponents') {
    return { aoe: 'cone', range: 2 };
  }
  if (m.damageClass === 'special') {
    return { aoe: 'single', range: 3 }; // proyectil a distancia
  }
  return { aoe: 'single', range: 1 }; // físico cuerpo a cuerpo
}
