import { describe, it, expect } from 'vitest';
import { GEN1_NAMES, isGen1, randomGen1Names } from '../src/engine/gen1.js';
import { LOOT_POOL_TIERS } from '../src/services/lootPool.js';
import { STARTER_POOL } from '../src/services/MatchManager.js';

describe('engine · Gen 1 (fuente única, T5.1)', () => {
  it('la lista canónica tiene exactamente 151 sin duplicados', () => {
    expect(GEN1_NAMES).toHaveLength(151);
    expect(new Set(GEN1_NAMES).size).toBe(151);
  });

  it('isGen1 acepta Gen 1 y rechaza Gen 2+', () => {
    expect(isGen1('bulbasaur')).toBe(true);
    expect(isGen1('MEWTWO')).toBe(true); // insensible a mayúsculas
    expect(isGen1('mew')).toBe(true);
    expect(isGen1('chikorita')).toBe(false); // #152
    expect(isGen1('lugia')).toBe(false);
  });

  it('la loot pool son 151 Pokémon, TODOS Gen 1', () => {
    const all = Object.values(LOOT_POOL_TIERS).flat();
    expect(all).toHaveLength(151);
    for (const n of all) expect(isGen1(n), `${n} no es Gen 1`).toBe(true);
    // Cubre exactamente la lista canónica (sin faltar ni sobrar).
    expect(new Set(all)).toEqual(new Set(GEN1_NAMES));
  });

  it('el pool de starters es todo Gen 1', () => {
    for (const n of STARTER_POOL) expect(isGen1(n), n).toBe(true);
  });
});

describe('engine · randomGen1Names — pool de draft aleatorio (T7)', () => {
  it('devuelve n nombres distintos y todos Gen 1', () => {
    const pool = randomGen1Names(50);
    expect(pool).toHaveLength(50);
    expect(new Set(pool).size).toBe(50); // sin duplicados
    for (const n of pool) expect(isGen1(n), n).toBe(true);
  });

  it('satura en 151 si se piden más de los que hay', () => {
    expect(randomGen1Names(999)).toHaveLength(151);
    expect(randomGen1Names(0)).toHaveLength(0);
  });

  it('con distinta semilla (rng) produce selecciones distintas', () => {
    const a = randomGen1Names(50, mulberry(1));
    const b = randomGen1Names(50, mulberry(2));
    expect(a).not.toEqual(b); // barajado dependiente del rng
  });
});

/** PRNG determinista simple para el test del barajado. */
function mulberry(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
