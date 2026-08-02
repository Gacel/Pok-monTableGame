import type { Hex, PokemonMove, PokemonSize } from './domain.js';

// Replicating basic hex logic needed for AoE
const DIRECTIONS: Hex[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

function hexAdd(a: Hex, b: Hex): Hex {
  return { q: a.q + b.q, r: a.r + b.r };
}

function hexDistance(a: Hex, b: Hex): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}

export function getSingleArea(target: Hex): Hex[] {
  return [target];
}

export function getRadiusArea(center: Hex, radius: number): Hex[] {
  const hexes: Hex[] = [];
  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q - radius);
    const r2 = Math.min(radius, -q + radius);
    for (let r = r1; r <= r2; r++) {
      hexes.push(hexAdd(center, { q, r }));
    }
  }
  return hexes;
}

export function getLineArea(start: Hex, target: Hex, length: number): Hex[] {
  const hexes: Hex[] = [];
  const dist = hexDistance(start, target);
  if (dist === 0) return [start];
  
  let bestDir = DIRECTIONS[0]!;
  let minD = Infinity;
  for (const dir of DIRECTIONS) {
    const cand = hexAdd(start, dir);
    const d = hexDistance(cand, target);
    if (d < minD) {
      minD = d;
      bestDir = dir;
    }
  }
  
  let curr = start;
  for (let i = 0; i < length; i++) {
    curr = hexAdd(curr, bestDir) as Hex;
    hexes.push(curr);
  }
  return hexes;
}

export function getConeArea(start: Hex, target: Hex, length: number): Hex[] {
  const hexes: Hex[] = [];
  const dist = hexDistance(start, target);
  if (dist === 0) return [start];
  
  let bestDir = DIRECTIONS[0]!;
  let minD = Infinity;
  let dirIdx = 0;
  for (let i = 0; i < DIRECTIONS.length; i++) {
    const cand = hexAdd(start, DIRECTIONS[i]!);
    const d = hexDistance(cand, target);
    if (d < minD) {
      minD = d;
      bestDir = DIRECTIONS[i]!;
      dirIdx = i;
    }
  }
  
  let curr = start;
  for (let i = 0; i < length; i++) {
    curr = hexAdd(curr, bestDir);
    hexes.push(curr);
    
    if (i > 0) {
      const leftDir = DIRECTIONS[(dirIdx + 5) % 6]!;
      const rightDir = DIRECTIONS[(dirIdx + 1) % 6]!;
      hexes.push(hexAdd(curr, leftDir));
      hexes.push(hexAdd(curr, rightDir));
    }
  }
  return hexes;
}

/**
 * Una onda es **autocentrada** si es radial y su alcance es 0 (terratemblor, surf,
 * autodestrucción…): siempre se centra sobre el propio lanzador, no sobre un objetivo.
 */
export function isAutocentered(move: Pick<PokemonMove, 'aoe' | 'range'>): boolean {
  return move.aoe === 'radius' && (move.range ?? 1) === 0;
}

/**
 * Radio efectivo de una onda autocentrada. Se expande por la **huella** del lanzador
 * (un `large` ocupa el anillo 1 alrededor de su centro), para que el temblor alcance
 * MÁS ALLÁ de su propio cuerpo en vez de morir sobre las casillas que ocupa.
 */
export function autocenteredRadius(radius: number | undefined, casterSize: PokemonSize): number {
  return Math.max(1, radius ?? 1) + (casterSize === 'large' ? 1 : 0);
}

export function calculateAoE(
  attackerHex: Hex,
  targetHex: Hex,
  aoe: string,
  range: number,
  radius?: number
): Hex[] {
  switch (aoe) {
    case 'single': return getSingleArea(targetHex);
    // El radio del AoE radial es explícito (`radius`), no derivado del alcance.
    case 'radius': return getRadiusArea(targetHex, Math.max(1, radius ?? 1));
    case 'line': return getLineArea(attackerHex, targetHex, range);
    case 'cone': return getConeArea(attackerHex, targetHex, range);
    default: return getSingleArea(targetHex);
  }
}
