import { Hex, hexAdd } from './hex.js';
import { Board } from './board.js';

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

export function getLegalMoves(hex: Hex, board: Board): Hex[] {
  const pokemon = board.getOccupant(hex);
  if (!pokemon) return [];

  const moves: Hex[] = [];

  if (pokemon.movementPattern === 'TANK') {
    // Rey: casillas adyacentes
    for (const dir of DIRECTIONS) {
      const target = hexAdd(hex, dir);
      const tile = board.getTile(target);
      if (tile && !tile.occupant) {
        moves.push(target);
      }
    }
  } else if (pokemon.movementPattern === 'SPEEDSTER') {
    // Caballo: saltos fijos, ignora obstáculos en el camino
    for (const jump of KNIGHT_JUMPS) {
      const target = hexAdd(hex, jump);
      const tile = board.getTile(target);
      if (tile && !tile.occupant) {
        moves.push(target);
      }
    }
  } else if (pokemon.movementPattern === 'FLYING') {
    // Alfil: desliza por las diagonales hasta topar con un obstáculo o el borde
    for (const dir of DIAGONALS) {
      let current = hexAdd(hex, dir);
      while (true) {
        const tile = board.getTile(current);
        if (!tile) break; // Fuera del tablero
        if (tile.occupant) break; // Bloqueado por otra pieza
        moves.push(current);
        current = hexAdd(current, dir); // Seguir avanzando
      }
    }
  }

  return moves;
}

export function isMoveLegal(from: Hex, to: Hex, board: Board): boolean {
  const moves = getLegalMoves(from, board);
  return moves.some(m => m.q === to.q && m.r === to.r);
}
