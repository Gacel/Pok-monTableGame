import type { Hex, Pokemon } from '../models/Types';
import { typeAdvantage } from '@transcendence/shared';

/**
 * IA del bot (partida local). No hay "IA" real: es la LISTEZA al elegir
 * enfrentamientos a su favor (ventaja de tipo, rematar, evitar malos combates).
 *
 * 3 niveles:
 *  1 FÁCIL   → acciones prácticamente aleatorias.
 *  2 NORMAL  → codicioso: ataca lo mejor disponible; si no, se acerca al rival.
 *  3 DIFÍCIL → prioriza remates y súper-efectivos, evita ataques desfavorables,
 *              y se posiciona contra el rival al que gana por tipo.
 *
 * Lógica PURA (recibe el estado ya resuelto) → testeable sin DOM ni red.
 */
export type BotLevel = 1 | 2 | 3;

export interface BotPieceOptions {
  from: Hex;
  pokemon: Pokemon;
  moves: Hex[];
  attacks: { hex: Hex; target: Pokemon }[];
}
export interface EnemyPiece {
  hex: Hex;
  pokemon: Pokemon;
}

export type BotDecision =
  | { type: 'attack'; from: Hex; to: Hex }
  | { type: 'move'; from: Hex; to: Hex }
  | { type: 'end' };

export function hexDistance(a: Hex, b: Hex): number {
  const s1 = -a.q - a.r;
  const s2 = -b.q - b.r;
  return Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(s1 - s2));
}

/** Daño aproximado (sin terreno) para valorar un ataque. */
function estDamage(att: Pokemon, def: Pokemon): number {
  const atk = att.atk ?? 50;
  const d = def.def ?? 40;
  const raw = Math.round(atk * typeAdvantage(att.type, def.type)) - Math.floor(d / 2);
  return Math.max(1, raw);
}

interface AttackCand {
  from: Hex;
  to: Hex;
  score: number;
  adv: number;
  kill: boolean;
}

function scoreAttack(from: Hex, to: Hex, att: Pokemon, def: Pokemon): AttackCand {
  const adv = typeAdvantage(att.type, def.type);
  const dmg = estDamage(att, def);
  const kill = dmg >= def.hp;
  const lowHp = 1 - def.hp / Math.max(1, def.maxHp);
  // Foco de fuego: rematar y golpear a rivales heridos pesa MÁS que la ventaja de
  // tipo, para que la IA cierre combates en vez de repartir daño.
  const score = adv * 100 + (kill ? 500 : 0) + lowHp * 140 + dmg;
  return { from, to, score, adv, kill };
}

/**
 * Penalización por terreno para un tipo (heurística de la IA; refleja las reglas
 * de services/game-service/src/engine/environment.ts). Mayor = peor sitio.
 * - Agua: los FIRE no pueden entrar → prohibitivo.
 * - Lava (FIRE): GRASS/ICE sufren mucho daño; otros algo; FIRE gana ATK (bonus).
 */
function terrainPenalty(type: string, biome: string | undefined): number {
  if (!biome) return 0;
  if (biome === 'WATER') return type === 'FIRE' ? 1000 : 0;
  if (biome === 'FIRE') {
    if (type === 'FIRE') return -10; // +20% ATK → terreno deseable
    if (type === 'FLYING') return 0; // inmune al daño de lava
    if (type === 'GRASS' || type === 'ICE') return 40;
    if (type === 'WATER') return 10;
    return 20;
  }
  return 0;
}

function pickTargetEnemy(mine: Pokemon, from: Hex, enemies: EnemyPiece[], level: BotLevel): EnemyPiece {
  const scored = enemies.map((e) => ({
    e,
    dist: hexDistance(from, e.hex),
    adv: typeAdvantage(mine.type, e.pokemon.type),
  }));
  // Difícil: entre los cercanos, prioriza aquel al que gana por tipo.
  scored.sort((a, b) => {
    if (level === 3 && b.adv !== a.adv) return b.adv - a.adv;
    return a.dist - b.dist;
  });
  return scored[0]!.e;
}

type BiomeOf = (hex: Hex) => string | undefined;

function bestMoveToward(
  pieces: BotPieceOptions[],
  enemies: EnemyPiece[],
  level: BotLevel,
  biomeOf?: BiomeOf
): BotDecision | null {
  if (!enemies.length) return null;
  let best: BotDecision | null = null;
  let bestGain = 0;
  for (const p of pieces) {
    if (!p.moves.length) continue;
    const target = pickTargetEnemy(p.pokemon, p.from, enemies, level);
    const cur = hexDistance(p.from, target.hex);
    for (const m of p.moves) {
      let gain = cur - hexDistance(m, target.hex);
      // DIFÍCIL: descuenta el terreno desfavorable del destino (evita meterse en
      // lava/agua). En hexes, así que dividimos la penalización para escalarla.
      if (level === 3 && biomeOf) gain -= terrainPenalty(p.pokemon.type, biomeOf(m)) / 20;
      if (gain > bestGain) {
        bestGain = gain;
        best = { type: 'move', from: p.from, to: m };
      }
    }
  }
  return best;
}

/**
 * Retirada táctica (solo DIFÍCIL): cuando no hay buen ataque ni avance útil, en
 * vez de pasar turno el bot se ALEJA del rival más peligroso (el que le gana por
 * tipo y está más cerca), evitando terreno malo. Devuelve null si no gana distancia.
 */
function bestRetreat(pieces: BotPieceOptions[], enemies: EnemyPiece[], biomeOf?: BiomeOf): BotDecision | null {
  if (!enemies.length) return null;
  let best: BotDecision | null = null;
  let bestScore = 0;
  for (const p of pieces) {
    if (!p.moves.length) continue;
    const threats = enemies.filter((e) => typeAdvantage(e.pokemon.type, p.pokemon.type) > 1.0);
    const pool = threats.length ? threats : enemies;
    const ref = pool.slice().sort((a, b) => hexDistance(p.from, a.hex) - hexDistance(p.from, b.hex))[0]!;
    const cur = hexDistance(p.from, ref.hex);
    for (const m of p.moves) {
      let score = hexDistance(m, ref.hex) - cur; // alejarse del rival = positivo
      if (biomeOf) score -= terrainPenalty(p.pokemon.type, biomeOf(m)) / 20;
      if (score > bestScore) {
        bestScore = score;
        best = { type: 'move', from: p.from, to: m };
      }
    }
  }
  return best;
}

/** Decide UNA acción del bot para el turno actual (o 'end' si no hay nada útil). */
export function decideBotAction(
  pieces: BotPieceOptions[],
  enemies: EnemyPiece[],
  level: BotLevel,
  rng: () => number,
  biomeOf?: BiomeOf
): BotDecision {
  const attacks: AttackCand[] = [];
  for (const p of pieces) {
    for (const a of p.attacks) attacks.push(scoreAttack(p.from, a.hex, p.pokemon, a.target));
  }

  // FÁCIL: aleatorio (con leve sesgo a atacar si puede).
  if (level === 1) {
    const moves = pieces.flatMap((p) => p.moves.map((m) => ({ from: p.from, to: m })));
    if (attacks.length && rng() < 0.6) {
      const c = attacks[Math.floor(rng() * attacks.length)]!;
      return { type: 'attack', from: c.from, to: c.to };
    }
    if (moves.length) {
      const m = moves[Math.floor(rng() * moves.length)]!;
      return { type: 'move', from: m.from, to: m.to };
    }
    return attacks.length ? { type: 'attack', from: attacks[0]!.from, to: attacks[0]!.to } : { type: 'end' };
  }

  attacks.sort((a, b) => b.score - a.score);
  const best = attacks[0];

  if (best) {
    if (level === 2) {
      // NORMAL: ataca si es favorable/neutral o si remata.
      if (best.adv >= 1.0 || best.kill) return { type: 'attack', from: best.from, to: best.to };
    } else {
      // DIFÍCIL: solo ataca si es favorable o letal (evita malos cambios).
      if (best.kill || best.adv >= 1.0) return { type: 'attack', from: best.from, to: best.to };
    }
  }

  const move = bestMoveToward(pieces, enemies, level, biomeOf);
  if (move) return move;

  // Sin avance posible:
  //  - NORMAL: ataca aunque sea desfavorable (codicioso).
  //  - DIFÍCIL: intenta RETIRADA táctica (alejarse del rival fuerte); si no gana
  //    distancia, pasa turno.
  if (best && level === 2) return { type: 'attack', from: best.from, to: best.to };
  if (level === 3) {
    const retreat = bestRetreat(pieces, enemies, biomeOf);
    if (retreat) return retreat;
  }
  return { type: 'end' };
}
