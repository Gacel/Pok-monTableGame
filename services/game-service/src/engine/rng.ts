/**
 * PRNG determinista (sin estado global, sin Math.random) para generación
 * procedural reproducible. Misma seed ⇒ misma secuencia ⇒ mismo mapa.
 */

/** Fuente de números pseudoaleatorios en el rango [0, 1). */
export type Rng = () => number;

/**
 * Deriva una seed uint32 estable a partir de una cadena (FNV-1a de 32 bits).
 * Permite usar seeds legibles como "transcendence-default".
 */
export function hashStringToSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    // multiplicación FNV con truncado a 32 bits
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: PRNG rápido de 32 bits con buena distribución. */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Entero en [min, max] (ambos inclusive) a partir de un Rng. */
export function seededInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}
