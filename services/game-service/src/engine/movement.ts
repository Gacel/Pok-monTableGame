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
 */
export function getMoveOptions(hex: Hex, board: Board): MoveOptions {
  const pokemon = board.getOccupant(hex);
  if (!pokemon) return { moves: [], attacks: [] };

  const moves: Hex[] = [];
  const attacks: Hex[] = [];

  const consider = (target: Hex): 'continue' | 'stop' => {
    const tile = board.getTile(target);
    if (!tile) return 'stop'; // fuera del tablero
    if (tile.occupant) {
      if (tile.occupant.playerId !== pokemon.playerId) attacks.push(target);
      return 'stop'; // enemigo o aliado bloquean el avance
    }
    if (canEnter(pokemon, tile.biome)) moves.push(target);
    return 'continue';
  };

  if (pokemon.movementPattern === 'TANK') {
    // Rey: casillas adyacentes
    for (const dir of DIRECTIONS) consider(hexAdd(hex, dir));
  } else if (pokemon.movementPattern === 'SPEEDSTER') {
    // Caballo: saltos fijos, ignora obstáculos en el camino
    for (const jump of KNIGHT_JUMPS) consider(hexAdd(hex, jump));
  } else if (pokemon.movementPattern === 'FLYING') {
    // Alfil: desliza por las diagonales hasta topar con un obstáculo o el borde
    for (const dir of DIAGONALS) {
      let current = hexAdd(hex, dir);
      while (consider(current) === 'continue') {
        current = hexAdd(current, dir);
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
