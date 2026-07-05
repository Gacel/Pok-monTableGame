import { describe, it, expect } from 'vitest';
import { buildTiers, rollTier, pickFromTier, BALLS, type Tier } from '../src/services/loot.js';

/** Rng determinista: devuelve en secuencia los valores [0,1) dados (cíclico). */
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length]!;
}

const roster = Array.from({ length: 8 }, (_, i) => ({
  name: `p${i}`,
  hp: 10 + i * 10,
  atk: 10 + i * 10,
  def: 10 + i * 10,
}));

describe('loot: buildTiers', () => {
  it('reparte el roster en 4 cuartiles por poder', () => {
    const tiers = buildTiers(roster);
    // 8 pokémon → 2 por tier; los más débiles en T1, los más fuertes en T4.
    expect(tiers[1]).toEqual(['p0', 'p1']);
    expect(tiers[2]).toEqual(['p2', 'p3']);
    expect(tiers[3]).toEqual(['p4', 'p5']);
    expect(tiers[4]).toEqual(['p6', 'p7']);
  });

  it('no pierde ni duplica pokémon', () => {
    const tiers = buildTiers(roster);
    const all = [tiers[1], tiers[2], tiers[3], tiers[4]].flat();
    expect(all.sort()).toEqual(roster.map((p) => p.name).sort());
  });

  it('tolera un roster vacío', () => {
    const tiers = buildTiers([]);
    expect(tiers).toEqual({ 1: [], 2: [], 3: [], 4: [] });
  });
});

describe('loot: rollTier', () => {
  it('mapea el valor del rng al tier según la distribución acumulada', () => {
    const dist = BALLS.normal!.dist; // [70,22,7,1]
    expect(rollTier(dist, () => 0.0)).toBe(1); // 0% → T1
    expect(rollTier(dist, () => 0.69)).toBe(1); // <70 → T1
    expect(rollTier(dist, () => 0.8)).toBe(2); // 70..92 → T2
    expect(rollTier(dist, () => 0.95)).toBe(3); // 92..99 → T3
    expect(rollTier(dist, () => 0.999)).toBe(4); // ≥99 → T4
  });
});

describe('loot: pickFromTier', () => {
  it('elige del tier pedido cuando tiene pokémon', () => {
    const tiers = buildTiers(roster);
    expect(pickFromTier(tiers, 4 as Tier, () => 0)).toBe('p6');
  });

  it('cae a un tier inferior si el pedido está vacío', () => {
    const tiers: Record<Tier, string[]> = { 1: ['a'], 2: [], 3: [], 4: [] };
    expect(pickFromTier(tiers, 4 as Tier, () => 0)).toBe('a');
  });

  it('sube a un tier superior si no hay inferiores', () => {
    const tiers: Record<Tier, string[]> = { 1: [], 2: [], 3: [], 4: ['z'] };
    expect(pickFromTier(tiers, 1 as Tier, () => 0)).toBe('z');
  });

  it('lanza si el roster está totalmente vacío', () => {
    const empty: Record<Tier, string[]> = { 1: [], 2: [], 3: [], 4: [] };
    expect(() => pickFromTier(empty, 2 as Tier, seq([0]))).toThrow();
  });
});
