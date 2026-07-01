import { Hex, hexAdd } from './hex.js';
import { Board } from './board.js';
import { canEnter } from './environment.js';

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

export interface MoveOptions {
  /** Casillas vacías a las que se puede desplazar (respetando el terreno). */
  moves: Hex[];
  /** Casillas ocupadas por un enemigo a las que se puede atacar. */
  attacks: Hex[];
}

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

  const consider = (target: Hex): 'continue' | 'stop' => {
    const tile = board.getTile(target);
    if (!tile) return 'stop'; // fuera del tablero
    const key = `${target.q},${target.r}`;
    if (tile.occupant) {
      if (!sameTeam(tile.occupant.playerId, pokemon.playerId)) {
        if (!attackSet.has(key)) {
          attackSet.add(key);
          attacks.push(target);
        }
      }
      return 'stop'; // enemigo o aliado bloquean el avance
    }
    if (canEnter(pokemon, tile.biome)) {
      if (!moveSet.has(key)) {
        moveSet.add(key);
        moves.push(target);
      }
    }
    return 'continue';
  };

  // 1) Paso adyacente garantizado: TODOS los Pokémon siempre pueden mover o atacar a 1 baldosa de distancia.
  for (const dir of DIRECTIONS) {
    consider(hexAdd(hex, dir));
  }

  if (pokemon.movementPattern === 'TANK') {
    // Rey: casillas adyacentes (ya cubierto arriba, pero lo mantenemos por claridad del patrón)
    for (const dir of DIRECTIONS) consider(hexAdd(hex, dir));
  } else if (pokemon.movementPattern === 'SPEEDSTER') {
    // Caballo: saltos fijos, ignora obstáculos en el camino
    for (const jump of KNIGHT_JUMPS) consider(hexAdd(hex, jump));
  } else if (pokemon.movementPattern === 'FLYING' || pokemon.type === 'FLYING') {
    // Alfil/Reina: el tipo FLYING específico es el de mayor rango del juego (hasta 10 casillas en todas las direcciones y diagonales)
    const maxSteps = pokemon.type === 'FLYING' ? 10 : 6;
    const dirs = pokemon.type === 'FLYING' ? [...DIRECTIONS, ...DIAGONALS] : DIAGONALS;
    for (const dir of dirs) {
      let current = hexAdd(hex, dir);
      let steps = 1;
      while (steps <= maxSteps && consider(current) === 'continue') {
        current = hexAdd(current, dir);
        steps++;
      }
    }
  }

  // 2) Bonus Agua: Si el Pokémon es de tipo WATER o está en una baldosa de agua y entra en agua,
  // puede recorrer hasta +3 baldosas adicionales dentro de baldosas conectadas de agua.
  if (pokemon.type === 'WATER' || board.getTile(hex)?.biome === 'WATER') {
    const waterSeeds: { hex: Hex; dist: number }[] = [];
    const startTile = board.getTile(hex);
    if (startTile && startTile.biome === 'WATER') {
      waterSeeds.push({ hex, dist: 0 });
    }
    for (const m of moves) {
      const t = board.getTile(m);
      if (t && t.biome === 'WATER') {
        waterSeeds.push({ hex: m, dist: 0 });
      }
    }

    const visitedWater = new Set<string>(waterSeeds.map(s => `${s.hex.q},${s.hex.r}`));
    const queue = [...waterSeeds];

    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (curr.dist >= 3) continue;

      for (const dir of DIRECTIONS) {
        const nextHex = hexAdd(curr.hex, dir);
        const nextKey = `${nextHex.q},${nextHex.r}`;
        if (visitedWater.has(nextKey)) continue;
        visitedWater.add(nextKey);

        const nextTile = board.getTile(nextHex);
        if (!nextTile || nextTile.biome !== 'WATER') continue; // solo dentro de agua

        if (nextTile.occupant) {
           if (!sameTeam(nextTile.occupant.playerId, pokemon.playerId)) {
             if (!attackSet.has(nextKey)) {
               attackSet.add(nextKey);
               attacks.push(nextHex);
             }
           }
        } else {
          if (canEnter(pokemon, nextTile.biome)) {
            if (!moveSet.has(nextKey)) {
              moveSet.add(nextKey);
              moves.push(nextHex);
            }
            queue.push({ hex: nextHex, dist: curr.dist + 1 });
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
