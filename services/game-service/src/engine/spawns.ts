import { Board, Biome } from './board.js';
import { Hex, hexNeighbors, hexDistance } from './hex.js';

/** ¿Es un bioma transitable a pie (todo menos agua)? */
export function isLandTransitable(biome: Biome): boolean {
  return biome !== 'WATER';
}

const key = (h: Hex): string => `${h.q},${h.r}`;

/**
 * Mayor componente conexa de TIERRA del tablero (flood-fill sobre no-WATER).
 * Garantiza que ambos equipos se coloquen en tierra mutuamente alcanzable.
 */
export function largestLandComponent(board: Board): Set<string> {
  const visited = new Set<string>();
  let best = new Set<string>();

  for (const tile of board.tiles.values()) {
    if (!isLandTransitable(tile.biome) || visited.has(key(tile.hex))) continue;

    const component = new Set<string>();
    const stack: Hex[] = [tile.hex];
    visited.add(key(tile.hex));
    while (stack.length > 0) {
      const cur = stack.pop()!;
      component.add(key(cur));
      for (const n of hexNeighbors(cur)) {
        const nt = board.getTile(n);
        if (!nt || !isLandTransitable(nt.biome) || visited.has(key(n))) continue;
        visited.add(key(n));
        stack.push(n);
      }
    }
    if (component.size > best.size) best = component;
  }
  return best;
}

const parseKey = (k: string): Hex => {
  const [q, r] = k.split(',').map(Number);
  return { q: q!, r: r! };
};

/**
 * Nodo más lejano (por distancia hex) desde `start`, restringido a la componente.
 * Se usa dos veces (doble-BFS) para aproximar el diámetro de la componente.
 */
function farthestInComponent(start: Hex, component: Set<string>): Hex {
  let far = start;
  let max = -1;
  for (const k of component) {
    const h = parseKey(k);
    const d = hexDistance(start, h);
    if (d > max) {
      max = d;
      far = h;
    }
  }
  return far;
}

/**
 * Racimo de `perTeam` tiles vacíos más cercanos a `center` dentro de la
 * componente, prefiriendo GRASS > SAND (evita spawns sobre FIRE/ICE).
 */
function clusterAround(
  board: Board,
  center: Hex,
  component: Set<string>,
  perTeam: number,
  taken: Set<string>
): Hex[] {
  const preference: Record<Biome, number> = { GRASS: 0, SAND: 1, FIRE: 2, ICE: 2, WATER: 9 };
  const candidates = Array.from(component)
    .map(parseKey)
    .filter((h) => {
      const t = board.getTile(h);
      return t && !t.occupant && !taken.has(key(h));
    })
    .sort((a, b) => {
      const da = hexDistance(center, a);
      const db = hexDistance(center, b);
      if (da !== db) return da - db;
      const pa = preference[board.getTile(a)!.biome];
      const pb = preference[board.getTile(b)!.biome];
      return pa - pb;
    });

  const chosen = candidates.slice(0, perTeam);
  for (const h of chosen) taken.add(key(h));
  return chosen;
}

/**
 * Elige spawns en extremos opuestos de la componente de tierra.
 * Doble-BFS para hallar los dos polos (A, B) y racimo de perTeam alrededor de cada uno.
 */
export function pickOppositeSpawns(
  board: Board,
  component: Set<string>,
  perTeam: number
): { team1: Hex[]; team2: Hex[] } {
  if (component.size < perTeam * 2) {
    throw new Error(
      `Componente de tierra demasiado pequeña (${component.size}) para ${perTeam * 2} spawns`
    );
  }
  const seed = parseKey(component.values().next().value!);
  const poleA = farthestInComponent(seed, component);
  const poleB = farthestInComponent(poleA, component);

  const taken = new Set<string>();
  const team1 = clusterAround(board, poleA, component, perTeam, taken);
  const team2 = clusterAround(board, poleB, component, perTeam, taken);
  return { team1, team2 };
}

/**
 * Elige spawns para hasta 4 equipos en las 4 esquinas de la componente de tierra.
 */
export function pickCornerSpawns(
  board: Board,
  component: Set<string>,
  perTeam: number,
  numTeams: number = 4
): Hex[][] {
  if (numTeams === 2) {
    const { team1, team2 } = pickOppositeSpawns(board, component, perTeam);
    return [team1, team2];
  }
  if (component.size < perTeam * numTeams) {
    throw new Error(
      `Componente de tierra demasiado pequeña (${component.size}) para ${perTeam * numTeams} spawns`
    );
  }

  const hexes = Array.from(component).map(parseKey);
  const scorers = [
    (h: Hex) => -(h.q + h.r), // Noroeste (Top-Left) -> Jugador 1 (Azul)
    (h: Hex) => (h.q + h.r),  // Sureste (Bottom-Right) -> Jugador 2 (Rojo)
    (h: Hex) => (h.q - h.r),  // Noreste (Top-Right) -> Jugador 3 (Violeta)
    (h: Hex) => -(h.q - h.r), // Suroeste (Bottom-Left) -> Jugador 4 (Amarillo)
  ];

  const taken = new Set<string>();
  const result: Hex[][] = [];

  for (let i = 0; i < numTeams; i++) {
    const scorer = scorers[i % scorers.length]!;
    let bestHex = hexes[0]!;
    let maxScore = -Infinity;
    for (const h of hexes) {
      const score = scorer(h);
      if (score > maxScore) {
        maxScore = score;
        bestHex = h;
      }
    }
    const cluster = clusterAround(board, bestHex, component, perTeam, taken);
    result.push(cluster);
  }

  return result;
}
