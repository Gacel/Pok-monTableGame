import { Biome, Pokemon, PokemonMove } from './board.js';
import { effectiveAtk, effectiveDef, typeAdvantage } from './environment.js';

/** Potencia de referencia: un movimiento de POWER_REF equivale al golpe básico. */
const POWER_REF = 60;
/** Bonus por STAB (movimiento del mismo tipo que el atacante). */
const STAB_MULT = 1.2;

/**
 * Daño de un ataque concreto (movimiento importado de PokeAPI).
 * El tipo de la VENTAJA lo aporta el movimiento (no el Pokémon), escalado por
 * su potencia y por el STAB.
 */
export function computeMoveDamage(
  attacker: Pokemon,
  defender: Pokemon,
  move: PokemonMove,
  attackerTerrain: Biome,
  defenderTerrain: Biome
): number {
  if (move.power <= 0) return 0; // movimientos de estado no hacen daño directo aún
  const atk = effectiveAtk(attacker, attackerTerrain);
  const def = effectiveDef(defender, defenderTerrain);
  const power = move.power;
  const adv = typeAdvantage(move.type, defender.type);
  const stab = move.type === attacker.type ? STAB_MULT : 1.0;
  const ambush = attacker.isHidden ? 1.5 : 1.0; // Bono de daño de emboscada
  const raw = Math.round(atk * (power / POWER_REF) * adv * stab * ambush) - Math.floor(def / 2);
  return Math.max(1, raw);
}

// ----------------------------------------------------------------------------
// Geometría AoE (Área de Efecto)
// ----------------------------------------------------------------------------

// ----------------------------------------------------------------------------
// Geometría AoE (Área de Efecto)
// ----------------------------------------------------------------------------
export { getSingleArea, getRadiusArea, getLineArea, getConeArea, calculateAoE } from '@transcendence/shared';
