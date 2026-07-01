import { describe, it, expect } from 'vitest';
import { createHex, hexDistance } from '../src/engine/hex.js';
import { Board, Pokemon } from '../src/engine/board.js';
import { getLegalMoves } from '../src/engine/movement.js';
import { collectResources } from '../src/engine/resources.js';

describe('Hex Engine Math', () => {
  it('calculates distance correctly', () => {
    const a = createHex(0, 0);
    const b = createHex(2, -1);
    expect(hexDistance(a, b)).toBe(2);
  });
});

describe('Board & Resources', () => {
  it('generates a basic board and collects resources', () => {
    const board = Board.generateBasic(1);
    // Radius 1 means 7 tiles
    expect(board.tiles.size).toBe(7);

    const charizard: Pokemon = { id: 'p1', playerId: 'player1', type: 'FIRE', movementPattern: 'FLYING', hp: 100, maxHp: 100 };
    const blastoise: Pokemon = { id: 'p2', playerId: 'player2', type: 'WATER', movementPattern: 'TANK', hp: 100, maxHp: 100 };

    board.setOccupant({ q: 0, r: 0 }, charizard); // Center is FIRE (hash 0)
    board.setOccupant({ q: 1, r: 0 }, blastoise); // (1,0) hash 1 -> WATER

    const res = collectResources(board);
    expect(res['player1']?.FIRE_CANDY).toBe(1);
    expect(res['player1']?.WATER_CANDY).toBe(0);
    
    expect(res['player2']?.WATER_CANDY).toBe(1);
  });
});

describe('Movement Patterns', () => {
  it('TANK (Rey) only moves to adjacent empty tiles', () => {
    const board = Board.generateBasic(2); // Radius 2
    const blastoise: Pokemon = { id: 'p2', playerId: 'player2', type: 'WATER', movementPattern: 'TANK', hp: 100, maxHp: 100 };
    const dummy: Pokemon = { id: 'p3', playerId: 'player1', type: 'GRASS', movementPattern: 'TANK', hp: 100, maxHp: 100 };
    
    board.setOccupant({ q: 0, r: 0 }, blastoise);
    // Block one adjacent tile
    board.setOccupant({ q: 1, r: 0 }, dummy);

    const moves = getLegalMoves({ q: 0, r: 0 }, board);
    // Normally 6 adjacent, 1 is blocked, so 5
    expect(moves.length).toBe(5);
    // Check that (1,0) is not in moves
    expect(moves.some(m => m.q === 1 && m.r === 0)).toBe(false);
  });

  it('FLYING (Alfil) moves in diagonals and stops at obstacles', () => {
    const board = Board.generateBasic(4); 
    const charizard: Pokemon = { id: 'p1', playerId: 'player1', type: 'FIRE', movementPattern: 'FLYING', hp: 100, maxHp: 100 };
    board.setOccupant({ q: 0, r: 0 }, charizard);

    const moves = getLegalMoves({ q: 0, r: 0 }, board);
    // On a radius 4 board, diagonal distances to the edge are 2 in each of the 6 diagonal directions.
    // E.g., (2, -1) and (4, -2) are on the board. Wait, (4, -2) has radius max(|4|, |-2|, |-2|) = 4. 
    // Yes, so it should be exactly 2 jumps per diagonal -> 12 moves total.
    expect(moves.length).toBe(12);
  });
  
  it('SPEEDSTER (Caballo) jumps exactly to L-shapes', () => {
    const board = Board.generateBasic(3); 
    const pikachu: Pokemon = { id: 'p4', playerId: 'player1', type: 'GRASS', movementPattern: 'SPEEDSTER', hp: 100, maxHp: 100 };
    board.setOccupant({ q: 0, r: 0 }, pikachu);

    const moves = getLegalMoves({ q: 0, r: 0 }, board);
    // 12 knight jumps, all are distance 3 and fit in radius 3.
    expect(moves.length).toBe(12);
  });
});
