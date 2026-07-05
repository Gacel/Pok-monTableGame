/**
 * Carga de sprites de Pokémon desde PokeAPI, con caché en memoria.
 *
 * ÚNICA implementación: antes este bloque fetch+parse estaba DUPLICADO en 6
 * sitios (GameController y 5 vistas). Centralizarlo elimina la duplicación y
 * añade caché (evita repetir peticiones).
 *
 * NOTA: idealmente debería apuntar al `pokeapi-proxy` interno (Redis) en vez de
 * a pokeapi.co directo; ver docs/audit/ARCHITECTURE_AUDIT.md (frontend #3).
 */
export interface SpritePair {
  /** GIF animado (gen-V black-white) o estático como fallback. */
  gif: string;
  /** Sprite estático (front_default). */
  static: string;
}

const cache = new Map<string, SpritePair>();

async function fetchPair(name: string): Promise<SpritePair> {
  const key = name.toLowerCase();
  const hit = cache.get(key);
  if (hit) return hit;
  try {
    const r = await fetch(`https://pokeapi.co/api/v2/pokemon/${key}`);
    if (!r.ok) return { gif: '', static: '' };
    const d = await r.json();
    const gif =
      d.sprites?.versions?.['generation-v']?.['black-white']?.animated?.front_default ||
      d.sprites?.front_default ||
      '';
    const pair: SpritePair = { gif, static: d.sprites?.front_default || gif };
    cache.set(key, pair);
    return pair;
  } catch {
    return { gif: '', static: '' };
  }
}

/** Sprite animado (o estático como fallback); '' si falla. Cacheado. */
export async function getSprite(name: string): Promise<string> {
  return (await fetchPair(name)).gif;
}

/** Par GIF + estático (para el tablero). Cacheado. */
export async function getSpritePair(name: string): Promise<SpritePair> {
  return fetchPair(name);
}
