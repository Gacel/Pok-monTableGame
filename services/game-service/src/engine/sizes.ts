import type { PokemonSize } from '@transcendence/shared';

/**
 * Tamaño por especie (Gen 1) — D6. Mapa curado (más fiable para los 151 que unos umbrales
 * de height/weight, que misclasifican casos como Onix —alto pero fino— o Snorlax —bajo pero
 * enorme—). `large` ocupa 7 hexes y no puede escalar montañas; `small` es puramente visual.
 * Se aplica en `PokemonService.getTemplate` (también sobre el template cacheado).
 */

const LARGE = new Set<string>([
  'venusaur', 'charizard', 'blastoise', 'arcanine', 'machamp', 'golem', 'rapidash',
  'slowbro', 'muk', 'cloyster', 'onix', 'hitmonlee', 'rhydon', 'kangaskhan', 'seaking',
  'gyarados', 'lapras', 'vaporeon', 'snorlax', 'dragonite', 'aerodactyl', 'exeggutor',
  'victreebel', 'nidoking', 'nidoqueen', 'tauros', 'articuno', 'zapdos', 'moltres', 'mewtwo',
]);

const SMALL = new Set<string>([
  'bulbasaur', 'caterpie', 'weedle', 'pidgey', 'rattata', 'spearow', 'ekans', 'pikachu',
  'sandshrew', 'nidoran-f', 'nidoran-m', 'clefairy', 'vulpix', 'jigglypuff', 'zubat',
  'oddish', 'paras', 'venonat', 'diglett', 'meowth', 'psyduck', 'mankey', 'poliwag', 'abra',
  'machop', 'bellsprout', 'tentacool', 'geodude', 'ponyta', 'magnemite', 'doduo', 'seel',
  'shellder', 'gastly', 'drowzee', 'krabby', 'voltorb', 'exeggcute', 'cubone', 'koffing',
  'horsea', 'goldeen', 'staryu', 'magikarp', 'eevee', 'omanyte', 'kabuto', 'dratini',
]);

export function sizeForSpecies(name: string): PokemonSize {
  const n = name.toLowerCase();
  if (LARGE.has(n)) return 'large';
  if (SMALL.has(n)) return 'small';
  return 'medium';
}
