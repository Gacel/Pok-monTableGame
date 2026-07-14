import { describe, it, expect } from 'vitest';
import { getMoveShape } from '../src/engine/moveShapes.js';
import { calculateAoE } from '@transcendence/shared';
import { Board, Pokemon } from '../src/engine/board.js';
import { GameService } from '../src/services/GameService.js';
import type { PlayerResources, PokemonMove } from '@transcendence/shared';

const res = (): PlayerResources => ({ FIRE_CANDY: 0, WATER_CANDY: 0, GRASS_CANDY: 0 });
const mk = (
  over: Partial<Pokemon> & Pick<Pokemon, 'id' | 'playerId' | 'type'>
): Pokemon => ({ hp: 100, maxHp: 100, atk: 50, def: 40, speed: 3, size: 'medium', ...over });

describe('engine · getMoveShape (catálogo híbrido, TA.1)', () => {
  it('curados: terratemblor = radius autocentrado con radio propio; hiperrayo = línea', () => {
    expect(getMoveShape({ name: 'earthquake' })).toEqual({ aoe: 'radius', range: 0, radius: 2 });
    expect(getMoveShape({ name: 'hyper-beam' })).toEqual({ aoe: 'line', range: 4 });
  });

  it('defaults: físico melee = single/range 1; especial = single/range 3', () => {
    expect(getMoveShape({ name: 'tackle', damageClass: 'physical', target: 'selected-pokemon' }))
      .toEqual({ aoe: 'single', range: 1 });
    expect(getMoveShape({ name: 'unknown-beam', damageClass: 'special', target: 'selected-pokemon' }))
      .toEqual({ aoe: 'single', range: 3 });
  });

  it('defaults por target: all-* = radius autocentrado; all-opponents = cono', () => {
    expect(getMoveShape({ name: 'x', target: 'all-other-pokemon' }))
      .toEqual({ aoe: 'radius', range: 0, radius: 1 });
    expect(getMoveShape({ name: 'y', target: 'all-opponents' }))
      .toEqual({ aoe: 'cone', range: 2 });
  });
});

describe('shared · calculateAoE con radio explícito', () => {
  it('radius usa el radio dado, no floor(range/2)', () => {
    const center = { q: 0, r: 0 };
    const r2 = calculateAoE(center, center, 'radius', 0, 2); // radio 2 aunque range 0
    // Un disco de radio 2 en hex tiene 19 casillas (1 + 6 + 12).
    expect(r2).toHaveLength(19);
    const r1 = calculateAoE(center, center, 'radius', 0, 1);
    expect(r1).toHaveLength(7); // radio 1 = 7 casillas
  });
});

/** Partida activa mínima con caster en (0,0). */
function activeGame(caster: Pokemon, extra?: (b: Board) => void): GameService {
  const board = Board.generateBasic(6);
  board.setOccupant({ q: 0, r: 0 }, caster);
  board.setOccupant({ q: 5, r: 0 }, mk({ id: 'enemy', playerId: 'player2', type: 'NORMAL' }));
  extra?.(board);
  return new GameService('t', board, ['player1', 'player2'], 'player1', 1, 'active', null,
    { player1: res(), player2: res() }, []);
}

describe('GameService.cast · validación de rango (TA.1)', () => {
  const MELEE: PokemonMove = { name: 'tackle', type: 'NORMAL', power: 40, damageClass: 'physical', range: 1, aoe: 'single' };
  const QUAKE: PokemonMove = { name: 'earthquake', type: 'GROUND', power: 90, damageClass: 'physical', range: 0, aoe: 'radius', radius: 2 };

  it('un melee (range 1) rechaza un objetivo a distancia 2', () => {
    const caster = mk({ id: 'c', playerId: 'player1', type: 'NORMAL', moves: [MELEE] });
    const game = activeGame(caster);
    const r = game.cast('player1', { q: 0, r: 0 }, { q: 2, r: 0 }, 0);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/fuera de rango/);
  });

  it('un radius (range 0) ya NO es lanzable en cualquier casilla (solo autocentrado)', () => {
    const caster = mk({ id: 'c', playerId: 'player1', type: 'GROUND', moves: [QUAKE] });
    const far = game_far(caster);
    // Lanzar lejos (dist 3) debe fallar por rango (antes se permitía por la exención de radius).
    expect(far.cast('player1', { q: 0, r: 0 }, { q: 3, r: 0 }, 0).ok).toBe(false);
    // Autocentrado (dist 0) sí es válido.
    const self = game_far(mk({ id: 'c', playerId: 'player1', type: 'GROUND', moves: [QUAKE] }));
    expect(self.cast('player1', { q: 0, r: 0 }, { q: 0, r: 0 }, 0).ok).toBe(true);
  });

  function game_far(caster: Pokemon): GameService {
    // Enemigo dentro del radio del autocentrado para que el cast autocentrado golpee.
    return activeGame(caster, (b) => b.setOccupant({ q: 1, r: 0 }, mk({ id: 'v', playerId: 'player2', type: 'NORMAL' })));
  }
});
