/**
 * Carga de sprites de Pokémon desde PokeAPI, con caché en memoria.
 *
 * ÚNICA implementación: antes este bloque fetch+parse estaba DUPLICADO en 6
 * sitios (GameController y 5 vistas). Centralizarlo elimina la duplicación y
 * añade caché (evita repetir peticiones).
 *
 * NOTA: idealmente debería apuntar al `pokeapi-proxy` interno (Redis) en vez de
 * a pokeapi.co directo; ver docs/archive/ARCHITECTURE_AUDIT.md (frontend #3).
 */
export interface SpritePair {
  /** GIF animado (gen-V black-white) o estático como fallback. */
  gif: string;
  /** Sprite estático (front_default). */
  static: string;
}

const cache = new Map<string, SpritePair>();

async function fetchPair(name: string, isShiny: boolean = false): Promise<SpritePair> {
  const key = name.toLowerCase();
  const cacheKey = isShiny ? `${key}-shiny` : key;
  const hit = cache.get(cacheKey);
  if (hit) return hit;
  try {
    const r = await fetch(`https://pokeapi.co/api/v2/pokemon/${key}`);
    if (!r.ok) return { gif: '', static: '' };
    const d = await r.json();
    
    // Cadena de fallback para shiny vs default
    const official = d.sprites?.other?.['official-artwork'];
    const home = d.sprites?.other?.home;
    const bw = d.sprites?.versions?.['generation-v']?.['black-white']?.animated;
    
    const artwork = isShiny ? official?.front_shiny : official?.front_default;
    const h = isShiny ? home?.front_shiny : home?.front_default;
    const staticSprite = isShiny 
      ? (d.sprites?.front_shiny || artwork || h || '') 
      : (d.sprites?.front_default || artwork || h || '');
      
    const gif = isShiny
      ? (bw?.front_shiny || staticSprite || '')
      : (bw?.front_default || staticSprite || '');
      
    const pair: SpritePair = { gif, static: staticSprite || gif };
    cache.set(cacheKey, pair);
    return pair;
  } catch {
    return { gif: '', static: '' };
  }
}

/** Sprite animado (o estático como fallback); '' si falla. Cacheado. */
export async function getSprite(name: string, isShiny: boolean = false): Promise<string> {
  return (await fetchPair(name, isShiny)).gif;
}

/** Par GIF + estático (para el tablero). Cacheado. */
export async function getSpritePair(name: string, isShiny: boolean = false): Promise<SpritePair> {
  return fetchPair(name, isShiny);
}
