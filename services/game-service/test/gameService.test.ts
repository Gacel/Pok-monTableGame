import { describe, it, expect } from 'vitest';
import { Board, Pokemon } from '../src/engine/board.js';
import { GameService } from '../src/services/GameService.js';

const mk = (
  over: Partial<Pokemon> & Pick<Pokemon, 'id' | 'playerId' | 'type' | 'movementPattern'>
): Pokemon => ({ hp: 100, maxHp: 100, atk: 50, def: 40, ...over });

describe('GameService · turnos y recursos', () => {
  it('valida turno, aplica movimiento, cambia de jugador y colecta recursos', () => {
    const board = Board.generateBasic(3);
    const p1 = mk({ id: 'p1', playerId: 'player1', type: 'WATER', movementPattern: 'TANK' });
    const p2 = mk({ id: 'p2', playerId: 'player2', type: 'GRASS', movementPattern: 'TANK' });
    const game = GameService.create('t1', board, [
      { hex: { q: 0, r: 0 }, pokemon: p1 },
      { hex: { q: 2, r: 0 }, pokemon: p2 },
    ]);

    let s = game.getStateDTO();
    expect(s.currentPlayer).toBe('player1');
    expect(s.turn).toBe(1);

    // Movimiento legal adyacente a casilla vacía (1,0).
    const res = game.play('player1', { q: 0, r: 0 }, { q: 1, r: 0 });
    expect(res.ok).toBe(true);
    s = res.state;
    expect(s.currentPlayer).toBe('player2'); // cambió el turno
    expect(s.turn).toBe(2);
    // (1,0) es WATER y (2,0) es GRASS en generateBasic → recursos deterministas.
    expect(s.resources['player1']?.WATER_CANDY).toBe(1);
    expect(s.resources['player2']?.GRASS_CANDY).toBe(1);

    // No es el turno de player1 → rechazado.
    const bad = game.play('player1', { q: 1, r: 0 }, { q: 0, r: 0 });
    expect(bad.ok).toBe(false);
    expect(bad.error).toMatch(/turno/i);
  });

  it('mover una pieza ajena o inexistente se rechaza', () => {
    const board = Board.generateBasic(3);
    const p1 = mk({ id: 'p1', playerId: 'player1', type: 'FIRE', movementPattern: 'TANK' });
    const p2 = mk({ id: 'p2', playerId: 'player2', type: 'WATER', movementPattern: 'TANK' });
    const game = GameService.create('t2', board, [
      { hex: { q: 0, r: 0 }, pokemon: p1 },
      { hex: { q: 1, r: 0 }, pokemon: p2 },
    ]);
    // player1 intenta mover la pieza de player2.
    const r1 = game.play('player1', { q: 1, r: 0 }, { q: 2, r: 0 });
    expect(r1.ok).toBe(false);
    // origen vacío
    const r2 = game.play('player1', { q: -3, r: 0 }, { q: -2, r: 0 });
    expect(r2.ok).toBe(false);
  });
});

describe('GameService · combate y victoria', () => {
  it('atacar a un enemigo adyacente resuelve combate y termina la partida', () => {
    const board = Board.generateBasic(3);
    // player1 con fuerte ventaja para ganar de forma determinista.
    const p1 = mk({ id: 'p1', playerId: 'player1', type: 'FIRE', movementPattern: 'TANK', atk: 200 });
    const p2 = mk({ id: 'p2', playerId: 'player2', type: 'GRASS', movementPattern: 'TANK', hp: 40, maxHp: 40 });
    const game = GameService.create('t3', board, [
      { hex: { q: 0, r: 0 }, pokemon: p1 },
      { hex: { q: 1, r: 0 }, pokemon: p2 }, // adyacente
    ]);

    const res = game.play('player1', { q: 0, r: 0 }, { q: 1, r: 0 });
    expect(res.ok).toBe(true);
    expect(res.combat).toBeDefined();
    expect(res.combat?.winnerId).toBe('p1');

    const s = res.state;
    expect(s.status).toBe('finished');
    expect(s.winner).toBe('player1');
    // El atacante ocupa la casilla del defensor; el defensor desaparece.
    const at10 = s.tiles.find((t) => t.hex.q === 1 && t.hex.r === 0);
    expect(at10?.occupant?.playerId).toBe('player1');
    const at00 = s.tiles.find((t) => t.hex.q === 0 && t.hex.r === 0);
    expect(at00?.occupant).toBeNull();
  });

  it('serializa y deserializa el estado sin perder información', () => {
    const board = Board.generateBasic(2);
    const p1 = mk({ id: 'p1', playerId: 'player1', type: 'FIRE', movementPattern: 'FLYING' });
    const p2 = mk({ id: 'p2', playerId: 'player2', type: 'WATER', movementPattern: 'TANK' });
    const game = GameService.create('t4', board, [
      { hex: { q: 0, r: 0 }, pokemon: p1 },
      { hex: { q: 1, r: 0 }, pokemon: p2 },
    ]);
    const json = game.serialize();
    const restored = GameService.deserialize(json);
    expect(restored.getStateDTO().id).toBe('t4');
    expect(restored.getStateDTO().players).toEqual(['player1', 'player2']);
  });
});
