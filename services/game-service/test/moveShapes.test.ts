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

describe('GameService.cast · rango, forma y ondas autocentradas', () => {
  const MELEE: PokemonMove = { name: 'tackle', type: 'NORMAL', power: 40, damageClass: 'physical', range: 1, aoe: 'single' };
  const QUAKE: PokemonMove = { name: 'earthquake', type: 'GROUND', power: 90, damageClass: 'physical', range: 0, aoe: 'radius', radius: 2 };
  // Radial CON alcance (no autocentrada): su centro sí debe respetar el rango.
  const ROCKSLIDE: PokemonMove = { name: 'rock-slide', type: 'NORMAL', power: 75, damageClass: 'physical', range: 2, aoe: 'radius', radius: 1 };

  it('un melee (range 1) rechaza un objetivo a distancia 2', () => {
    const caster = mk({ id: 'c', playerId: 'player1', type: 'NORMAL', moves: [MELEE] });
    const game = activeGame(caster);
    const r = game.cast('player1', { q: 0, r: 0 }, { q: 2, r: 0 }, 0);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/fuera de rango/);
  });

  it('una onda radial CON alcance no es lanzable fuera de su rango (no hay rango infinito)', () => {
    const caster = mk({ id: 'c', playerId: 'player1', type: 'NORMAL', moves: [ROCKSLIDE] });
    const game = activeGame(caster); // enemigo lejano en (5,0)
    expect(game.cast('player1', { q: 0, r: 0 }, { q: 3, r: 0 }, 0).ok).toBe(false); // dist 3 > range 2
    expect(game.cast('player1', { q: 0, r: 0 }, { q: 2, r: 0 }, 0).ok).toBe(true); // dist 2 = range 2
  });

  it('una onda autocentrada (terratemblor) se centra SIEMPRE en el lanzador, se clique donde se clique', () => {
    const victim = mk({ id: 'v', playerId: 'player2', type: 'NORMAL', hp: 500, maxHp: 500 });
    const caster = mk({ id: 'c', playerId: 'player1', type: 'GROUND', moves: [QUAKE] });
    const game = activeGame(caster, (b) => b.setOccupant({ q: 1, r: 0 }, victim));
    // Clic en una casilla lejana: NO falla por rango (es autocentrada) y golpea al vecino.
    const r = game.cast('player1', { q: 0, r: 0 }, { q: 4, r: 0 }, 0);
    expect(r.ok).toBe(true);
    expect(victim.hp).toBeLessThan(500);
  });

  it('el radio de un autocentrado se EXPANDE con la huella del coloso (alcanza más allá de su cuerpo)', () => {
    // Enemigo a distancia 3 del centro. Con radius 2 solo lo alcanza un large (radio efectivo 3).
    const farEnemy = () => mk({ id: 'v', playerId: 'player2', type: 'NORMAL', hp: 500, maxHp: 500 });

    const medVictim = farEnemy();
    const medium = mk({ id: 'm', playerId: 'player1', type: 'GROUND', size: 'medium', moves: [QUAKE] });
    const g1 = activeGame(medium, (b) => b.setOccupant({ q: 3, r: 0 }, medVictim));
    g1.cast('player1', { q: 0, r: 0 }, { q: 0, r: 0 }, 0);
    expect(medVictim.hp).toBe(500); // radio 2: no llega a dist 3

    const bigVictim = farEnemy();
    // El coloso ocupa (0,0)+vecinos; el enemigo en (3,0) queda libre y a dist 3 del centro.
    const large = mk({ id: 'l', playerId: 'player1', type: 'GROUND', size: 'large', moves: [QUAKE] });
    const g2 = activeGame(large, (b) => b.setOccupant({ q: 3, r: 0 }, bigVictim));
    g2.cast('player1', { q: 0, r: 0 }, { q: 0, r: 0 }, 0);
    expect(bigVictim.hp).toBeLessThan(500); // radio efectivo 3: sí llega
  });
});
