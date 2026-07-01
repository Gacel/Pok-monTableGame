import { Biome, Pokemon } from './board.js';

/**
 * Modificadores ambientales y de tipo (lógica pura, sin estado externo).
 *
 * Reglas (ver docs/IMPLEMENTATION_PLAN.md C2.6):
 *  - Terreno FIRE:  +20% ATK a Pokémon de FIRE, −15% DEF a Pokémon de GRASS.
 *  - Terreno WATER (río): Pokémon WATER ignoran penalizaciones de movimiento;
 *                         Pokémon FIRE no pueden entrar (bloqueados).
 *  - Ventaja de tipo (rueda clásica): FIRE > GRASS > WATER > FIRE.
 */

/** Multiplicador de ataque por ventaja de tipo del atacante frente al defensor. */
export function typeAdvantage(attacker: string, defender: string): number {
  const beats: Record<string, string[]> = {
    FIRE: ['GRASS', 'ICE'],
    WATER: ['FIRE'],
    GRASS: ['WATER'],
    ELECTRIC: ['WATER', 'FLYING'],
    ICE: ['GRASS', 'FLYING', 'DRAGON'],
    POISON: ['GRASS', 'FAIRY'],
    FLYING: ['GRASS'],
    PSYCHIC: ['POISON'],
    DRAGON: ['DRAGON'],
    FAIRY: ['DRAGON'],
  };
  if (beats[attacker]?.includes(defender)) return 1.5; // super efectivo
  if (beats[defender]?.includes(attacker)) return 0.5; // poco efectivo
  return 1.0; // neutro
}

/** ATK efectivo de un Pokémon situado sobre un bioma dado. */
export function effectiveAtk(pokemon: Pokemon, terrain: Biome): number {
  const base = pokemon.atk ?? 50;
  let mult = 1.0;
  if (terrain === 'FIRE' && pokemon.type === 'FIRE') mult += 0.2; // +20%
  return Math.round(base * mult);
}

/** DEF efectiva de un Pokémon situado sobre un bioma dado. */
export function effectiveDef(pokemon: Pokemon, terrain: Biome): number {
  const base = pokemon.def ?? 40;
  let mult = 1.0;
  if (terrain === 'FIRE' && pokemon.type === 'GRASS') mult -= 0.15; // −15%
  return Math.max(0, Math.round(base * mult));
}

/**
 * ¿Puede un Pokémon entrar/permanecer en un bioma?
 * Los Pokémon de FIRE no pueden pisar agua (río).
 */
export function canEnter(pokemon: Pokemon, terrain: Biome): boolean {
  if (terrain === 'WATER' && pokemon.type === 'FIRE') return false;
  return true;
}

/** Daño por turno sufrido por un Pokémon al permanecer en un terreno (ej. lava / FIRE). */
export function terrainDamage(pokemon: Pokemon, terrain: Biome): number {
  if (terrain === 'FIRE') {
    if (pokemon.type === 'FIRE' || pokemon.type === 'FLYING') return 0;
    const turns = pokemon.lavaTurns && pokemon.lavaTurns > 0 ? pokemon.lavaTurns : 1;
    const multiplier = Math.pow(2, turns - 1);
    if (pokemon.type === 'WATER') return 1 * multiplier;
    if (pokemon.type === 'GRASS' || pokemon.type === 'ICE') return 4 * multiplier;
    return 2 * multiplier;
  }
  return 0;
}
