import { Hex, hexAdd } from './hex.js';
import { Board } from './board.js';
import { getTerrainCost } from './environment.js';

export const DIRECTIONS = [
  { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
  { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }
];

// Diagonales en un grid hexagonal
export const DIAGONALS = [
  { q: 2, r: -1 }, { q: 1, r: -2 }, { q: -1, r: -1 },
  { q: -2, r: 1 }, { q: -1, r: 2 }, { q: 1, r: 1 }
];

// Saltos de caballo (2 pasos en una dirección, 1 en la adyacente)
export const KNIGHT_JUMPS = [
  { q: 3, r: -1 }, { q: 3, r: -2 }, { q: 2, r: -3 },
  { q: 1, r: -3 }, { q: -1, r: -2 }, { q: -2, r: -1 },
  { q: -3, r: 1 }, { q: -3, r: 2 }, { q: -2, r: 3 },
  { q: -1, r: 3 }, { q: 1, r: 2 }, { q: 2, r: 1 }
];

// `MoveOptions` vive en @transcendence/shared. Se re-exporta aquí.
export type { MoveOptions } from '@transcendence/shared';
import type { MoveOptions } from '@transcendence/shared';

/**
 * Calcula movimientos y ataques legales según el patrón del Pokémon.
 * - Los movimientos a casilla vacía respetan `canEnter` (p.ej. FIRE no entra a agua).
 * - Un enemigo alcanzable es un objetivo de ATAQUE (inicia combate), no un movimiento.
 * - Un aliado bloquea (ni movimiento ni ataque).
 * - `sameTeam` define quién es aliado (modo 2v2); por defecto solo uno mismo.
 */
export function getMoveOptions(
  hex: Hex,
  board: Board,
  sameTeam: (a: string, b: string) => boolean = (a, b) => a === b
): MoveOptions {
  const pokemon = board.getOccupant(hex);
  if (!pokemon) return { moves: [], attacks: [] };

  const moveSet = new Set<string>();
  const attackSet = new Set<string>();
  const moves: Hex[] = [];
  const attacks: Hex[] = [];

  const speed = pokemon.speed ?? 3;

  // Dijkstra para encontrar celdas alcanzables según el coste del terreno (PM)
  // key -> coste mínimo acumulado
  const costSoFar = new Map<string, number>();
  // queue priorizada rudimentaria (el grid es pequeño)
  const queue: { hex: Hex; cost: number }[] = [{ hex, cost: 0 }];
  costSoFar.set(`${hex.q},${hex.r}`, 0);

  while (queue.length > 0) {
    // Extraer el de menor coste
    queue.sort((a, b) => a.cost - b.cost);
    const curr = queue.shift()!;

    if (curr.cost > speed) continue;

    for (const dir of DIRECTIONS) {
      const nextHex = hexAdd(curr.hex, dir);
      const nextKey = `${nextHex.q},${nextHex.r}`;
      const nextTile = board.getTile(nextHex);

      if (!nextTile) continue;

      if (nextTile.occupant) {
        if (!sameTeam(nextTile.occupant.playerId, pokemon.playerId)) {
          // Es un enemigo, podemos atacarle si está a rango 1 del inicio o de un paso legal.
          // Wait, los ataques en un juego tactics suelen poder hacerse desde CUALQUIER
          // casilla a la que te puedas mover. Para simplificar, si podemos movernos a la casilla
          // anterior, el enemigo es un target de ataque.
          // Como los ataques directos son rango 1, si curr.cost <= speed, el enemigo adyacente es atacable.
          if (!attackSet.has(nextKey)) {
            attackSet.add(nextKey);
            attacks.push(nextHex);
          }
        }
        continue; // No se puede atravesar a otros Pokémon (aliados o enemigos) en esta versión simple.
      }

      const stepCost = getTerrainCost(pokemon, nextTile.biome);
      if (stepCost === Infinity) continue;

      const newCost = curr.cost + stepCost;
      if (newCost <= speed) {
        if (!costSoFar.has(nextKey) || newCost < costSoFar.get(nextKey)!) {
          costSoFar.set(nextKey, newCost);
          queue.push({ hex: nextHex, cost: newCost });
          if (!moveSet.has(nextKey)) {
            moveSet.add(nextKey);
            moves.push(nextHex);
          }
        }
      }
    }
  }

  return { moves, attacks };
}

/** Solo las casillas vacías legales (compatibilidad con tests/uso previo). */
export function getLegalMoves(hex: Hex, board: Board): Hex[] {
  return getMoveOptions(hex, board).moves;
}

export function isMoveLegal(from: Hex, to: Hex, board: Board): boolean {
  return getLegalMoves(from, board).some(m => m.q === to.q && m.r === to.r);
}

export function isAttackLegal(from: Hex, to: Hex, board: Board): boolean {
  return getMoveOptions(from, board).attacks.some(m => m.q === to.q && m.r === to.r);
}
