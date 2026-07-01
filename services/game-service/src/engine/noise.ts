/**
 * Value noise 2D casero (sin dependencias externas, CLAUDE.md prohíbe librerías
 * fuera de la tabla). Produce campos continuos para elevación/temperatura/humedad.
 */

export interface NoiseField {
  /** Muestra el campo en (x, y). Devuelve un valor ~[0, 1]. */
  sample(x: number, y: number): number;
}

/** Hash entero determinista de una celda de la retícula → [0, 1). */
function hash2(ix: number, iy: number, seed: number): number {
  let h = seed >>> 0;
  h = Math.imul(h ^ (ix | 0), 0x27d4eb2d);
  h = Math.imul(h ^ (iy | 0), 0x165667b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/** Interpolación smoothstep (t·t·(3−2t)). */
function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Crea un campo de value noise con interpolación bilineal suavizada. */
export function makeValueNoise(seed: number): NoiseField {
  return {
    sample(x: number, y: number): number {
      const x0 = Math.floor(x);
      const y0 = Math.floor(y);
      const fx = smooth(x - x0);
      const fy = smooth(y - y0);

      const v00 = hash2(x0, y0, seed);
      const v10 = hash2(x0 + 1, y0, seed);
      const v01 = hash2(x0, y0 + 1, seed);
      const v11 = hash2(x0 + 1, y0 + 1, seed);

      const top = lerp(v00, v10, fx);
      const bottom = lerp(v01, v11, fx);
      return lerp(top, bottom, fy);
    },
  };
}

/**
 * Ruido fractal (suma de octavas). Devuelve un valor normalizado en [0, 1].
 */
export function fractalNoise(
  field: NoiseField,
  x: number,
  y: number,
  octaves: number,
  persistence: number,
  lacunarity: number,
  baseFrequency: number
): number {
  let amplitude = 1;
  let frequency = baseFrequency;
  let sum = 0;
  let ampSum = 0;
  for (let o = 0; o < octaves; o++) {
    sum += field.sample(x * frequency, y * frequency) * amplitude;
    ampSum += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }
  return sum / ampSum;
}
