import type { Rng } from '../engine/rng.js';

/**
 * Loot de las pokéballs de la tienda. Los Pokémon se reparten en 4 TIERS por
 * poder (hp+atk+def, cuartiles) y cada bola tiene una distribución de tiers:
 * la más cara da mayor probabilidad de Pokémon buenos; la más barata, mínima.
 */
export type Tier = 1 | 2 | 3 | 4;

interface Statted {
  name: string;
  hp: number;
  atk: number;
  def: number;
}

const power = (p: Statted): number => p.hp + p.atk + p.def;

/**
 * Reparte el roster en 4 tiers por CUARTILES de poder (auto-balanceado):
 * el 25% más débil → T1, …, el 25% más fuerte → T4.
 */
export function buildTiers(roster: Statted[]): Record<Tier, string[]> {
  const sorted = [...roster].sort((a, b) => power(a) - power(b));
  const n = sorted.length || 1;
  const tiers: Record<Tier, string[]> = { 1: [], 2: [], 3: [], 4: [] };
  sorted.forEach((p, i) => {
    const q = Math.min(3, Math.floor((i / n) * 4)); // 0..3
    tiers[(q + 1) as Tier].push(p.name);
  });
  return tiers;
}

export interface BallDef {
  key: string;
  price: number;
  /** Probabilidad (%) por tier [T1, T2, T3, T4]; suma 100. */
  dist: [number, number, number, number];
}

/** Definición autoritativa de las bolas (precio + distribución de tiers). */
export const BALLS: Record<string, BallDef> = {
  normal: { key: 'normal', price: 500, dist: [70, 22, 7, 1] },
  super: { key: 'super', price: 1000, dist: [45, 33, 17, 5] },
  ultra: { key: 'ultra', price: 2000, dist: [22, 33, 30, 15] },
  master: { key: 'master', price: 10000, dist: [5, 20, 35, 40] },
};

/** Tira un tier según la distribución de la bola. */
export function rollTier(dist: BallDef['dist'], rng: Rng): Tier {
  const r = rng() * 100;
  let acc = 0;
  for (let i = 0; i < 4; i++) {
    acc += dist[i]!;
    if (r < acc) return (i + 1) as Tier;
  }
  return 4;
}

/** Elige un Pokémon aleatorio del tier (si está vacío, sube al inferior). */
export function pickFromTier(tiers: Record<Tier, string[]>, tier: Tier, rng: Rng): string {
  for (let t = tier; t >= 1; t--) {
    const pool = tiers[t as Tier];
    if (pool.length) return pool[Math.floor(rng() * pool.length)]!;
  }
  for (let t = tier + 1; t <= 4; t++) {
    const pool = tiers[t as Tier];
    if (pool.length) return pool[Math.floor(rng() * pool.length)]!;
  }
  throw new Error('Roster vacío: no hay Pokémon para el loot');
}
