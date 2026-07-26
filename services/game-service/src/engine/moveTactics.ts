/**
 * Efectos tácticos de desplazamiento de moves (lista curada manual — D5).
 * `nombre PokeAPI → valor`. Solo aplican a moves que hacen daño (los `status` como
 * `roar`/`whirlwind` se filtran en la curación, así que aquí se usan moves con potencia).
 */

/** Empuje (knockback): hexes que retrocede el objetivo tras el impacto (1-3) — T3.1. */
export const KNOCKBACK_MOVES: Record<string, number> = {
  'dragon-tail': 2,
  'circle-throw': 2,
  'vital-throw': 1,
  bulldoze: 1,
  stomp: 1,
  headbutt: 1,
  'force-palm': 1,
  'rock-smash': 1,
  twister: 1,
  gust: 1,
  'dragon-rush': 1,
  extrasensory: 1,
};

export function getKnockback(name: string): number | undefined {
  return KNOCKBACK_MOVES[name];
}
