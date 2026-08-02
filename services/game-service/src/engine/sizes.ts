import type { PokemonSize } from '@transcendence/shared';
import { GEN1_DIMENSIONS } from './gen1Dimensions.js';

/**
 * Tamaño de un Pokémon (T4.1/T4.8, D6). Dos conceptos separados:
 *  - `sizeForSpecies`: tamaño **táctico** (footprint). `large` = ocupa 7 hexes, no escala
 *    montañas, inmune a empuje, hace de muro. **Lista curada**: la fórmula height/weight
 *    metería colosos indeseados (arbok/dragonair/mewtwo… puntúan alto por altura), así que
 *    los colosos se eligen a mano.
 *  - `visualScale`: escala **visual** del sprite, **continua** a partir de las dimensiones
 *    reales (height·∛weight de PokeAPI), para que cada especie tenga su tamaño (un Lapras se
 *    ve grande aunque su footprint sea medium).
 */

/** Colosos (footprint de 7 hexes). Lista curada (D6). */
const LARGE = new Set<string>([
  'onix', 'gyarados', 'dragonite', 'kangaskhan', 'snorlax', 'venusaur', 'exeggutor', 'golem',
]);

/** Pequeños (footprint 1 hex; solo visual, escala también continua). */
const SMALL = new Set<string>([
  'bulbasaur', 'caterpie', 'weedle', 'pidgey', 'rattata', 'spearow', 'ekans', 'pikachu',
  'sandshrew', 'nidoran-f', 'nidoran-m', 'clefairy', 'vulpix', 'jigglypuff', 'zubat',
  'oddish', 'paras', 'venonat', 'diglett', 'meowth', 'psyduck', 'mankey', 'poliwag', 'abra',
  'machop', 'bellsprout', 'tentacool', 'geodude', 'ponyta', 'magnemite', 'doduo', 'seel',
  'shellder', 'gastly', 'drowzee', 'krabby', 'voltorb', 'exeggcute', 'cubone', 'koffing',
  'horsea', 'goldeen', 'staryu', 'magikarp', 'eevee', 'omanyte', 'kabuto', 'dratini',
]);

export function sizeForSpecies(name: string): PokemonSize {
  const n = name.toLowerCase();
  if (LARGE.has(n)) return 'large';
  if (SMALL.has(n)) return 'small';
  return 'medium';
}

/**
 * Escala visual continua del sprite a partir de las dimensiones reales:
 * `metric = height_m · ∛weight_kg`, comprimida y acotada a ~[0.72, 2.15]. Determinista;
 * sin dimensiones conocidas devuelve 1.
 */
export function visualScale(name: string): number {
  const dim = GEN1_DIMENSIONS[name.toLowerCase()];
  if (!dim) return 1;
  const heightM = dim[0] / 10;
  const weightKg = dim[1] / 10;
  const metric = heightM * Math.cbrt(Math.max(0.1, weightKg));
  const scale = 0.62 * Math.pow(Math.max(0.01, metric), 0.42);
  return Math.round(Math.max(0.72, Math.min(2.15, scale)) * 100) / 100;
}
