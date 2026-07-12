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

// ---------------------------------------------------------------- cube / líneas

/** Coordenada cúbica (q + r + s === 0). El `Hex` de shared es axial (q, r). */
export interface Cube {
  q: number;
  r: number;
  s: number;
}

export function axialToCube(h: Hex): Cube {
  return { q: h.q, r: h.r, s: -h.q - h.r };
}

export function cubeToAxial(c: Cube): Hex {
  return { q: c.q, r: c.r };
}

/**
 * Redondeo cúbico: dado un hex fraccionario (axial), devuelve el hex entero más
 * cercano manteniendo el invariante q + r + s = 0 (corrige la coord de mayor
 * desviación). Base de `hexLineDraw` y de la conversión píxel→hex.
 */
export function hexRound(frac: { q: number; r: number }): Hex {
  const x = frac.q;
  const z = frac.r;
  const y = -x - z; // tercera coord cúbica
  let rx = Math.round(x);
  let ry = Math.round(y);
  let rz = Math.round(z);
  const dx = Math.abs(rx - x);
  const dy = Math.abs(ry - y);
  const dz = Math.abs(rz - z);
  if (dx > dy && dx > dz) {
    rx = -ry - rz;
  } else if (dy > dz) {
    ry = -rx - rz;
  } else {
    rz = -rx - ry;
  }
  // Normaliza -0 → 0 (Math.round(-0.1) === -0), para igualdad estructural limpia.
  return { q: rx + 0, r: rz + 0 };
}

/**
 * Traza la línea recta real entre dos hexes: interpola linealmente y redondea cada
 * paso. Devuelve la secuencia CONTIGUA de A a B, ambos incluidos (longitud
 * hexDistance(a,b) + 1). A diferencia de `getLineArea` (que encaja a una de 6
 * direcciones), esto sí sigue la recta punto a punto ⇒ sirve para LoS/bodyblocking
 * y direcciones de empuje/dash.
 */
export function hexLineDraw(a: Hex, b: Hex): Hex[] {
  const n = hexDistance(a, b);
  if (n === 0) return [{ q: a.q, r: a.r }];
  // Nudge cúbico (ε, ε, -2ε) en ambos extremos: rompe empates cuando la recta cae
  // justo en la frontera entre dos hexes, sin desplazar los extremos al redondear.
  const eps = 1e-6;
  const aq = a.q + eps;
  const ar = a.r + eps;
  const bq = b.q + eps;
  const br = b.r + eps;
  const results: Hex[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    results.push(hexRound({ q: aq + (bq - aq) * t, r: ar + (br - ar) * t }));
  }
  return results;
}
