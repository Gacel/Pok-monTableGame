import { describe, it, expect } from 'vitest';
import { Board, Pokemon } from '../src/engine/board.js';
import { getMoveOptions } from '../src/engine/movement.js';
import type { Hex } from '@transcendence/shared';

const mk = (
  over: Partial<Pokemon> & Pick<Pokemon, 'id' | 'playerId' | 'type'>
): Pokemon => ({ hp: 100, maxHp: 100, atk: 50, def: 40, speed: 2, size: 'medium', ...over });

const has = (hexes: Hex[], q: number, r: number) => hexes.some((h) => h.q === q && h.r === r);

/**
 * El único camino de 2 pasos entre (0,0) y (2,0) pasa por (1,0) (su único vecino
 * común). Con speed=2 y un bloqueador en (1,0), (2,0) solo es alcanzable atravesando.
 */
function boardWithBlocker(mover: Pokemon, blocker: Pokemon): Board {
  const board = Board.generateBasic(6);
  board.setOccupant({ q: 0, r: 0 }, mover);
  board.setOccupant({ q: 1, r: 0 }, blocker);
  return board;
}

describe('engine · getMoveOptions — Fantasma atraviesa piezas (T2.1)', () => {
  it('un no-Fantasma queda bloqueado por el ocupante (no alcanza la casilla de detrás)', () => {
    const mover = mk({ id: 'm', playerId: 'p1', type: 'NORMAL', speed: 2 });
    const blocker = mk({ id: 'b', playerId: 'p2', type: 'NORMAL' });
    const opts = getMoveOptions({ q: 0, r: 0 }, boardWithBlocker(mover, blocker));

    expect(has(opts.moves, 2, 0)).toBe(false); // bloqueado
    expect(has(opts.moves, 1, 0)).toBe(false); // ocupada
    expect(has(opts.attacks, 1, 0)).toBe(true); // enemigo adyacente = objetivo
  });

  it('un Fantasma atraviesa la pieza y alcanza la casilla de detrás, sin poder terminar encima', () => {
    const ghost = mk({ id: 'g', playerId: 'p1', type: 'GHOST', speed: 2 });
    const blocker = mk({ id: 'b', playerId: 'p2', type: 'NORMAL' });
    const opts = getMoveOptions({ q: 0, r: 0 }, boardWithBlocker(ghost, blocker));

    expect(has(opts.moves, 2, 0)).toBe(true);  // atraviesa (1,0) y llega a (2,0)
    expect(has(opts.moves, 1, 0)).toBe(false); // no puede terminar en la ocupada
    expect(has(opts.attacks, 1, 0)).toBe(true); // sigue marcando ataque al enemigo
  });

  it('un Fantasma atraviesa también a un ALIADO (D1), sin atacarlo', () => {
    const ghost = mk({ id: 'g', playerId: 'p1', type: 'GHOST', speed: 2 });
    const ally = mk({ id: 'a', playerId: 'p1', type: 'NORMAL' });
    const opts = getMoveOptions({ q: 0, r: 0 }, boardWithBlocker(ghost, ally));

    expect(has(opts.moves, 2, 0)).toBe(true);   // atraviesa al aliado
    expect(has(opts.attacks, 1, 0)).toBe(false); // no se ataca a un aliado
  });

  it('ninguna casilla ocupada aparece nunca en moves (Fantasma)', () => {
    const ghost = mk({ id: 'g', playerId: 'p1', type: 'GHOST', speed: 3 });
    const blocker = mk({ id: 'b', playerId: 'p2', type: 'NORMAL' });
    const board = boardWithBlocker(ghost, blocker);
    const opts = getMoveOptions({ q: 0, r: 0 }, board);

    for (const m of opts.moves) {
      expect(board.getOccupant(m), `moves no debe incluir la ocupada ${m.q},${m.r}`).toBeFalsy();
    }
  });
});
