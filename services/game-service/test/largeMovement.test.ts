import { describe, it, expect } from 'vitest';
import { Board, Pokemon } from '../src/engine/board.js';
import { getMoveOptions } from '../src/engine/movement.js';
import type { Hex } from '@transcendence/shared';

const mk = (
  over: Partial<Pokemon> & Pick<Pokemon, 'id' | 'playerId' | 'type'>
): Pokemon => ({ hp: 100, maxHp: 100, atk: 50, def: 40, speed: 3, size: 'medium', ...over });

const has = (hexes: Hex[], q: number, r: number) => hexes.some((h) => h.q === q && h.r === r);

describe('engine · movimiento de Pokémon grandes (T4.5)', () => {
  it('un large en campo abierto puede moverse (no lo bloquea su propio cuerpo) sin importar la casilla consultada', () => {
    const big = mk({ id: 'b', playerId: 'p1', type: 'NORMAL', size: 'large', speed: 3 });
    const board = Board.generateBasic(8);
    board.setOccupant({ q: 0, r: 0 }, big); // centro (0,0), ocupa (0,0)+vecinos

    const fromCenter = getMoveOptions({ q: 0, r: 0 }, board);
    const fromEdge = getMoveOptions({ q: 1, r: 0 }, board); // casilla del borde del large

    expect(fromCenter.moves.length).toBeGreaterThan(0);         // se puede mover
    // Mismo resultado se consulte por el centro o por una casilla del cuerpo.
    expect(new Set(fromEdge.moves.map((h) => `${h.q},${h.r}`)))
      .toEqual(new Set(fromCenter.moves.map((h) => `${h.q},${h.r}`)));
  });

  it('no ofrece destinos donde la huella (7 hexes) no cabe', () => {
    const big = mk({ id: 'b', playerId: 'p1', type: 'NORMAL', size: 'large', speed: 3 });
    const board = Board.generateBasic(8);
    board.setOccupant({ q: 0, r: 0 }, big);
    // Bloqueadores que impiden que la huella quepa al desplazar el centro a (2,0).
    board.setOccupant({ q: 3, r: 0 }, mk({ id: 'x', playerId: 'p2', type: 'ROCK' }));

    const opts = getMoveOptions({ q: 0, r: 0 }, board);
    // Cada destino ofrecido debe permitir colocar las 7 casillas libres.
    for (const m of opts.moves) {
      for (const oh of board.getOccupiedHexes(big, m)) {
        const occ = board.getOccupant(oh);
        expect(occ === null || occ.id === 'b', `huella pisa a otro en ${oh.q},${oh.r}`).toBe(true);
      }
    }
  });

  it('un medium se comporta igual que antes (sin regresión)', () => {
    const p = mk({ id: 'm', playerId: 'p1', type: 'NORMAL', speed: 2 });
    const board = Board.generateBasic(6);
    // Camino de hierba controlado (evita que el agua encarezca el paso).
    for (const h of [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }]) board.getTile(h)!.biome = 'GRASS';
    board.setOccupant({ q: 0, r: 0 }, p);
    const opts = getMoveOptions({ q: 0, r: 0 }, board);
    expect(has(opts.moves, 1, 0)).toBe(true);
    expect(has(opts.moves, 2, 0)).toBe(true);
  });
});
