/**
 * Especies **voladoras** de Gen 1 (tienen el tipo Flying en cualquier slot en PokeAPI).
 *
 * El dominio usa un ÚNICO tipo por Pokémon y casi ningún volador tiene Flying como primario
 * (Pidgey→Normal, Charizard→Fire, Zubat→Poison, Gyarados→Water…), así que su condición de
 * volador se perdía. Este set la recupera de forma determinista para inmunizarlos al daño de
 * terreno de suelo (lava y pantano) — no pisan el suelo. Solo afecta al DAÑO de terreno, no
 * al movimiento.
 */
const AIRBORNE = new Set<string>([
  'charizard',
  'butterfree',
  'pidgey', 'pidgeotto', 'pidgeot',
  'spearow', 'fearow',
  'zubat', 'golbat',
  'farfetchd',
  'doduo', 'dodrio',
  'scyther',
  'gyarados',
  'aerodactyl',
  'articuno', 'zapdos', 'moltres',
  'dragonite',
]);

/** ¿La especie es voladora (inmune al daño de terreno de suelo)? Por nombre PokeAPI. */
export function isAirborne(name: string): boolean {
  return AIRBORNE.has(name.toLowerCase());
}
