import { describe, it, expect } from 'vitest';
import { createHex, hexDistance } from '../src/engine/hex.js';
import { Board, Pokemon } from '../src/engine/board.js';
import { getLegalMoves } from '../src/engine/movement.js';
import { collectResources } from '../src/engine/resources.js';
import { terrainDamage } from '../src/engine/environment.js';

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

  it('FLYING (Alfil) moves in diagonals plus adjacent tiles', () => {
    const board = Board.generateBasic(4); 
    const charizard: Pokemon = { id: 'p1', playerId: 'player1', type: 'FIRE', movementPattern: 'FLYING', hp: 100, maxHp: 100 };
    board.setOccupant({ q: 0, r: 0 }, charizard);

    const moves = getLegalMoves({ q: 0, r: 0 }, board);
    // 12 saltos diagonales + 4 casillas adyacentes accesibles (las otras 2 son agua, donde FIRE no entra) = 16
    expect(moves.length).toBe(16);
  });
  
  it('SPEEDSTER (Caballo) jumps to L-shapes plus adjacent tiles', () => {
    const board = Board.generateBasic(3); 
    const pikachu: Pokemon = { id: 'p4', playerId: 'player1', type: 'GRASS', movementPattern: 'SPEEDSTER', hp: 100, maxHp: 100 };
    board.setOccupant({ q: 0, r: 0 }, pikachu);

    const moves = getLegalMoves({ q: 0, r: 0 }, board);
    // 12 saltos de caballo + 6 casillas adyacentes garantizadas = 18.
    expect(moves.length).toBe(18);
  });

  it('WATER Pokémon get +3 bonus movement within contiguous water tiles', () => {
    const board = new Board();
    board.setTile({ hex: { q: 0, r: 0 }, biome: 'WATER', occupant: null });
    board.setTile({ hex: { q: 1, r: 0 }, biome: 'WATER', occupant: null });
    board.setTile({ hex: { q: 2, r: 0 }, biome: 'WATER', occupant: null });
    board.setTile({ hex: { q: 3, r: 0 }, biome: 'WATER', occupant: null });
    board.setTile({ hex: { q: 4, r: 0 }, biome: 'WATER', occupant: null });

    const squirtle: Pokemon = { id: 'p5', playerId: 'player1', type: 'WATER', movementPattern: 'TANK', hp: 100, maxHp: 100 };
    board.setOccupant({ q: 0, r: 0 }, squirtle);

    const moves = getLegalMoves({ q: 0, r: 0 }, board);
    expect(moves.some(m => m.q === 4 && m.r === 0)).toBe(true);
  });

  it('orientates Pokémon towards center on spawn and updates facing on left/right move', () => {
    const board = new Board();
    board.setTile({ hex: { q: -2, r: 0 }, biome: 'GRASS', occupant: null }); // Izquierda del centro
    board.setTile({ hex: { q: 2, r: 0 }, biome: 'GRASS', occupant: null });  // Derecha del centro
    board.setTile({ hex: { q: -1, r: 0 }, biome: 'GRASS', occupant: null });
    board.setTile({ hex: { q: -1, r: 1 }, biome: 'GRASS', occupant: null }); // Movimiento vertical

    const pLeft: Pokemon = { id: 'pl1', playerId: 'player1', type: 'GRASS', movementPattern: 'TANK', hp: 100, maxHp: 100 };
    const pRight: Pokemon = { id: 'pr1', playerId: 'player2', type: 'GRASS', movementPattern: 'TANK', hp: 100, maxHp: 100 };

    board.setOccupant({ q: -2, r: 0 }, pLeft);
    board.setOccupant({ q: 2, r: 0 }, pRight);

    // Al nacer a la izquierda (q=-2), debe mirar a la derecha para ver el centro
    expect(pLeft.facing).toBe('right');
    // Al nacer a la derecha (q=2), debe mirar a la izquierda para ver el centro
    expect(pRight.facing).toBe('left');

    // Mover pLeft hacia la derecha (a q=-1)
    board.moveOccupant({ q: -2, r: 0 }, { q: -1, r: 0 });
    expect(pLeft.facing).toBe('right');

    // Mover pLeft de vuelta a la izquierda (a q=-2) -> debe cambiar orientación a 'left'
    board.moveOccupant({ q: -1, r: 0 }, { q: -2, r: 0 });
    expect(pLeft.facing).toBe('left');

    // Mover verticalmente en el mismo eje X (por ejemplo q=-2, r=0 a q=-1, r=-2 -> wait! en hex q+r/2 es el X real)
    // Para no mover horizontalmente: delta(q + r/2) == 0 => delta.r = -2 * delta.q. Ej: de (0,0) a (1,-2).
    const boardV = new Board();
    boardV.setTile({ hex: { q: 0, r: 0 }, biome: 'GRASS', occupant: null });
    boardV.setTile({ hex: { q: 1, r: -2 }, biome: 'GRASS', occupant: null });
    const pVert: Pokemon = { id: 'pv1', playerId: 'player1', type: 'GRASS', movementPattern: 'TANK', hp: 100, maxHp: 100, facing: 'right' };
    boardV.setOccupant({ q: 0, r: 0 }, pVert);
    boardV.moveOccupant({ q: 0, r: 0 }, { q: 1, r: -2 });
    // Mantener la misma orientación porque no hubo desplazamiento horizontal (derecha/izquierda)
    expect(pVert.facing).toBe('right');
  });
});

describe('Exponential Lava Damage', () => {
  it('scales damage exponentially with lavaTurns', () => {
    const pWater: Pokemon = { id: 'w1', playerId: 'player1', type: 'WATER', movementPattern: 'TANK', hp: 100, maxHp: 100, lavaTurns: 1 };
    const pGrass: Pokemon = { id: 'g1', playerId: 'player2', type: 'GRASS', movementPattern: 'TANK', hp: 100, maxHp: 100, lavaTurns: 1 };
    const pFire: Pokemon = { id: 'f1', playerId: 'player3', type: 'FIRE', movementPattern: 'TANK', hp: 100, maxHp: 100, lavaTurns: 5 };
    const pFlying: Pokemon = { id: 'fl1', playerId: 'player4', type: 'FLYING', movementPattern: 'FLYING', hp: 100, maxHp: 100, lavaTurns: 3 };

    // En turno 1: WATER recibe 1 * 2^0 = 1, GRASS recibe 4 * 2^0 = 4 (x2 por debilidad al fuego), FIRE y FLYING reciben 0
    expect(terrainDamage(pWater, 'FIRE')).toBe(1);
    expect(terrainDamage(pGrass, 'FIRE')).toBe(4);
    expect(terrainDamage(pFire, 'FIRE')).toBe(0);
    expect(terrainDamage(pFlying, 'FIRE')).toBe(0);

    // En turno 2: WATER recibe 1 * 2^1 = 2, GRASS recibe 4 * 2^1 = 8
    pWater.lavaTurns = 2;
    pGrass.lavaTurns = 2;
    expect(terrainDamage(pWater, 'FIRE')).toBe(2);
    expect(terrainDamage(pGrass, 'FIRE')).toBe(8);

    // En turno 3: WATER recibe 1 * 2^2 = 4, GRASS recibe 4 * 2^2 = 16
    pWater.lavaTurns = 3;
    pGrass.lavaTurns = 3;
    expect(terrainDamage(pWater, 'FIRE')).toBe(4);
    expect(terrainDamage(pGrass, 'FIRE')).toBe(16);
  });
});
