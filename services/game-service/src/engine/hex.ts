// `Hex` vive en @transcendence/shared (única fuente de verdad). Se re-exporta
// aquí para no romper los múltiples imports `from './hex.js'`.
export type { Hex } from '@transcendence/shared';
import type { Hex } from '@transcendence/shared';

export function createHex(q: number, r: number): Hex {
  return { q, r };
}

export function hexAdd(a: Hex, b: Hex): Hex {
  return { q: a.q + b.q, r: a.r + b.r };
}

export function hexSubtract(a: Hex, b: Hex): Hex {
  return { q: a.q - b.q, r: a.r - b.r };
}

export function hexDistance(a: Hex, b: Hex): number {
  const sA = -a.q - a.r;
  const sB = -b.q - b.r;
  return Math.max(
    Math.abs(a.q - b.q),
    Math.abs(a.r - b.r),
    Math.abs(sA - sB)
  );
}

const HEX_DIRECTIONS: Hex[] = [
  { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
  { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }
];

export function hexNeighbor(hex: Hex, direction: number): Hex {
  return hexAdd(hex, HEX_DIRECTIONS[direction % 6]!);
}

export function hexNeighbors(hex: Hex): Hex[] {
  return HEX_DIRECTIONS.map(dir => hexAdd(hex, dir));
}

// Compare two hexes for equality
export function hexEqual(a: Hex, b: Hex): boolean {
  return a.q === b.q && a.r === b.r;
}
