import { Biome, Pokemon, PokemonMove } from './board.js';
import { effectiveAtk, effectiveDef, typeAdvantage } from './environment.js';

export interface CombatBlow {
  attackerId: string;
  defenderId: string;
  damage: number;
  defenderHpAfter: number;
}

export interface CombatResult {
  winnerId: string;
  loserId: string;
  attacker: Pokemon; // estado final (hp actualizado)
  defender: Pokemon; // estado final (hp actualizado)
  blows: CombatBlow[];
  log: string[];
}

/**
 * Daño de un golpe (determinista, sin azar → testeable).
 * damage = max(1, round(ATK_ef * ventajaTipo) − DEF_ef/2)
 */
export function computeDamage(
  attacker: Pokemon,
  defender: Pokemon,
  attackerTerrain: Biome,
  defenderTerrain: Biome
): number {
  const atk = effectiveAtk(attacker, attackerTerrain);
  const def = effectiveDef(defender, defenderTerrain);
  const adv = typeAdvantage(attacker.type, defender.type);
  const raw = Math.round(atk * adv) - Math.floor(def / 2);
  return Math.max(1, raw);
}

/** Potencia de referencia: un movimiento de POWER_REF equivale al golpe básico. */
const POWER_REF = 60;
/** Bonus por STAB (movimiento del mismo tipo que el atacante). */
const STAB_MULT = 1.2;

/**
 * Daño de un ataque concreto (movimiento importado de PokeAPI).
 * El tipo de la VENTAJA lo aporta el movimiento (no el Pokémon), escalado por
 * su potencia y por el STAB. Determinista → testeable.
 * damage = max(1, round(ATK_ef * (power/60) * ventajaTipoMov * STAB) − DEF_ef/2)
 */
export function computeMoveDamage(
  attacker: Pokemon,
  defender: Pokemon,
  move: PokemonMove,
  attackerTerrain: Biome,
  defenderTerrain: Biome
): number {
  const atk = effectiveAtk(attacker, attackerTerrain);
  const def = effectiveDef(defender, defenderTerrain);
  const power = move.power > 0 ? move.power : 40;
  const adv = typeAdvantage(move.type, defender.type);
  const stab = move.type === attacker.type ? STAB_MULT : 1.0;
  const raw = Math.round(atk * (power / POWER_REF) * adv * stab) - Math.floor(def / 2);
  return Math.max(1, raw);
}

/**
 * Resuelve un combate por turnos hasta que un Pokémon cae.
 * El atacante golpea primero; se alternan hasta hp <= 0.
 * Opera sobre COPIAS (no muta los originales); devuelve el estado final.
 */
export function resolveCombat(
  attackerIn: Pokemon,
  defenderIn: Pokemon,
  attackerTerrain: Biome,
  defenderTerrain: Biome,
  maxRounds = 100
): CombatResult {
  const attacker: Pokemon = { ...attackerIn };
  const defender: Pokemon = { ...defenderIn };
  const blows: CombatBlow[] = [];
  const log: string[] = [];

  const nameOf = (p: Pokemon) => (p.name ?? p.id).toUpperCase();
  log.push(`¡${nameOf(attacker)} ataca a ${nameOf(defender)}!`);

  let attackerTurn = true;
  let rounds = 0;
  while (attacker.hp > 0 && defender.hp > 0 && rounds < maxRounds) {
    rounds++;
    const [off, def, offTerrain, defTerrain] = attackerTurn
      ? [attacker, defender, attackerTerrain, defenderTerrain]
      : [defender, attacker, defenderTerrain, attackerTerrain];

    const dmg = computeDamage(off, def, offTerrain, defTerrain);
    def.hp = Math.max(0, def.hp - dmg);
    blows.push({
      attackerId: off.id,
      defenderId: def.id,
      damage: dmg,
      defenderHpAfter: def.hp,
    });
    log.push(`${nameOf(off)} inflige ${dmg} de daño (${nameOf(def)}: ${def.hp} HP).`);
    attackerTurn = !attackerTurn;
  }

  const attackerWon = attacker.hp > 0 && defender.hp <= 0;
  const winner = attackerWon ? attacker : defender;
  const loser = attackerWon ? defender : attacker;
  log.push(`${nameOf(winner)} gana el combate.`);

  return {
    winnerId: winner.id,
    loserId: loser.id,
    attacker,
    defender,
    blows,
    log,
  };
}
