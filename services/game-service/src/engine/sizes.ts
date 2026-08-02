import type { PokemonSize } from '@transcendence/shared';

/**
 * Tamaño por especie (Gen 1) — D6. Mapa curado (más fiable para los 151 que unos umbrales
 * de height/weight, que misclasifican casos como Onix —alto pero fino— o Snorlax —bajo pero
 * enorme—). `large` ocupa 7 hexes y no puede escalar montañas; `small` es puramente visual.
 * Se aplica en `PokemonService.getTemplate` (también sobre el template cacheado).
 */

// Solo colosos de verdad (mucho volumen/altura). Se dejan como `medium` los altos pero
// esbeltos o de tamaño humano (Mewtwo, los pájaros legendarios, Machamp, Rapidash…).
const LARGE = new Set<string>([
  'venusaur', 'charizard', 'blastoise', 'arcanine', 'golem', 'onix', 'rhydon', 'kangaskhan',
  'gyarados', 'lapras', 'snorlax', 'dragonite', 'aerodactyl', 'exeggutor', 'nidoking', 'nidoqueen',
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
