/**
 * Bolas (pokéballs) como botín/objeto. ÚNICA fuente de verdad compartida entre
 * game-service y frontend: claves internas, nombre de sprite PokeAPI y pesos del
 * cofre. La lógica de loot (distribución de tiers por bola) vive en el backend
 * (`services/loot.ts`), que usa estas mismas claves.
 */

/** Claves internas de las bolas (coinciden con las de `BALLS` en loot.ts). */
export const BALL_KEYS = ['normal', 'super', 'ultra', 'master'] as const;
export type BallKey = (typeof BALL_KEYS)[number];

/**
 * Nombre del sprite en PokeAPI (sprites/items). Es también el `item_key` con el
 * que se guardan las bolas en `owned_items`, de modo que el inventario renderiza
 * el sprite correcto sin mapeos extra.
 */
export const BALL_SPRITE: Record<BallKey, string> = {
  normal: 'poke-ball',
  super: 'great-ball',
  ultra: 'ultra-ball',
  master: 'master-ball',
};

/** Inverso de BALL_SPRITE: nombre de sprite/item_key → clave interna. */
export const SPRITE_TO_BALL: Record<string, BallKey> = {
  'poke-ball': 'normal',
  'great-ball': 'super',
  'ultra-ball': 'ultra',
  'master-ball': 'master',
};

/** Etiqueta legible por bola (para UI/logs). */
export const BALL_LABEL: Record<BallKey, string> = {
  normal: 'Poké Ball',
  super: 'Great Ball',
  ultra: 'Ultra Ball',
  master: 'Master Ball',
};

/**
 * Pesos de aparición en el cofre (ponderado por rareza): la Poké Ball es común y
 * la Master Ball (mejor loot) es rara. No tienen por qué sumar 100.
 */
export const CHEST_WEIGHTS: Record<BallKey, number> = {
  normal: 50,
  super: 30,
  ultra: 15,
  master: 5,
};

/** Elige una bola según CHEST_WEIGHTS. `rnd` en [0,1) (Math.random o RNG del engine). */
export function pickChestBall(rnd: number): BallKey {
  const total = BALL_KEYS.reduce((s, k) => s + CHEST_WEIGHTS[k], 0);
  let r = rnd * total;
  for (const k of BALL_KEYS) {
    r -= CHEST_WEIGHTS[k];
    if (r < 0) return k;
  }
  return 'normal';
}
