import { Biome, Pokemon } from '@transcendence/shared';

// `typeAdvantage` vive en @transcendence/shared (la usa también la IA del cliente).
export { typeAdvantage } from '@transcendence/shared';

/** ATK efectivo de un Pokémon situado sobre un bioma dado. */
export function effectiveAtk(pokemon: Pokemon, terrain: Biome): number {
  const base = pokemon.atk ?? 50;
  let mult = 1.0;
  if (terrain === 'FIRE' && pokemon.type === 'FIRE') mult += 0.2; // +20%
  if (terrain === 'WATER' && pokemon.type === 'WATER') mult += 0.2;
  if (terrain === 'GRASS' && pokemon.type === 'GRASS') mult += 0.2;
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
 * Coste de PM (Puntos de Movimiento) para entrar en un bioma.
 * Infinity significa que no puede entrar.
 */
export function getTerrainCost(pokemon: Pokemon, terrain: Biome): number {
  if (!canEnter(pokemon, terrain)) return Infinity;
  
  if (pokemon.type === 'FLYING' || pokemon.type === 'GHOST') {
    return 1; // Vuelan o atraviesan todo sin penalización
  }

  switch (terrain) {
    case 'WATER':
      return pokemon.type === 'WATER' ? 1 : 2;
    case 'TALL_GRASS':
      return (pokemon.type === 'BUG' || pokemon.type === 'GRASS') ? 1 : 2;
    case 'MOUNTAIN':
      return (pokemon.type === 'ROCK' || pokemon.type === 'FIGHTING') ? 1 : 2;
    case 'ICE':
      return pokemon.type === 'ICE' ? 1 : 2;
    case 'SWAMP':
      return pokemon.type === 'POISON' ? 1 : 2;
    default:
      return 1;
  }
}

/**
 * ¿Puede un Pokémon entrar/permanecer en un bioma?
 */
export function canEnter(pokemon: Pokemon, terrain: Biome): boolean {
  if (pokemon.type === 'FLYING' || pokemon.type === 'GHOST') return true;

  if (terrain === 'MOUNTAIN' && pokemon.size === 'large') {
    return false; // Los grandes no pueden escalar (a menos que vuelen)
  }
  if (terrain === 'WATER' && pokemon.type === 'FIRE') {
    return false; // Fuego no pisa agua
  }
  return true;
}

/** Daño por turno sufrido por un Pokémon al permanecer en un terreno. */
export function terrainDamage(pokemon: Pokemon, terrain: Biome): number {
  if (pokemon.type === 'FLYING') return 0; // No tocan el suelo

  if (terrain === 'FIRE') {
    if (pokemon.type === 'FIRE') return 0;
    const turns = pokemon.lavaTurns && pokemon.lavaTurns > 0 ? pokemon.lavaTurns : 1;
    const multiplier = Math.pow(2, turns - 1);
    if (pokemon.type === 'WATER') return 1 * multiplier;
    if (pokemon.type === 'GRASS' || pokemon.type === 'ICE') return 4 * multiplier;
    return 2 * multiplier;
  }
  
  if (terrain === 'SWAMP') {
    if (pokemon.type === 'POISON' || pokemon.type === 'STEEL') return 0;
    return 2; // Daño tóxico constante
  }
  
  return 0;
}
