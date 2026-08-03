import { STONE_ES } from '../engine/evolution.js';

/**
 * Catálogo de PIEDRAS evolutivas de Gen 1 (T9.2). Son objetos (`owned_items`, kind `stone`)
 * con `item_key` = slug PokeAPI (mismo que trae el catálogo de evolución y el sprite de items).
 * Se compran en la tienda y caen como botín en los cofres.
 */
export const STONE_KIND = 'stone';

export interface StoneDef {
  key: string;
  price: number;
  label: string;
}

/** Las 5 piedras de Gen 1. Precio uniforme (objeto premium, por debajo de la Masterball). */
export const STONES: StoneDef[] = (
  ['fire-stone', 'water-stone', 'thunder-stone', 'leaf-stone', 'moon-stone'] as const
).map((key) => ({ key, price: 3000, label: STONE_ES[key] ?? key }));

const STONE_KEYS = new Set(STONES.map((s) => s.key));

/** ¿Es un slug de piedra válido? */
export function isStone(key: string): boolean {
  return STONE_KEYS.has(key);
}

/** Definición de una piedra por su slug (o `undefined`). */
export function stoneByKey(key: string): StoneDef | undefined {
  return STONES.find((s) => s.key === key);
}
