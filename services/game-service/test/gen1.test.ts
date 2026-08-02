import { describe, it, expect } from 'vitest';
import { GEN1_NAMES, isGen1 } from '../src/engine/gen1.js';
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
