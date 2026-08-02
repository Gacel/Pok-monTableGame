import { describe, it, expect } from 'vitest';
import { Board, Pokemon } from '../src/engine/board.js';
import { GameService } from '../src/services/GameService.js';
import type { PlayerResources, PokemonMove } from '@transcendence/shared';

const res = (): PlayerResources => ({ FIRE_CANDY: 0, WATER_CANDY: 0, GRASS_CANDY: 0 });
const mk = (
  over: Partial<Pokemon> & Pick<Pokemon, 'id' | 'playerId' | 'type'>
): Pokemon => ({ hp: 300, maxHp: 300, atk: 60, def: 0, speed: 3, size: 'medium', ...over });

// Proyectil de largo alcance, single.
const RANGED: PokemonMove = { name: 'hyper-beam-x', type: 'NORMAL', power: 60, damageClass: 'special', range: 6, aoe: 'single' };

function build(caster: Pokemon, extra: [{ q: number; r: number }, Pokemon][]): GameService {
  const board = Board.generateBasic(8);
  board.setOccupant({ q: 0, r: 0 }, caster);
  for (const [hex, p] of extra) board.setOccupant(hex, p);
  return new GameService('t', board, ['player1', 'player2'], 'player1', 1, 'active', null,
    { player1: res(), player2: res() }, []);
}

describe('engine · línea de visión / bodyblocking (T4.3)', () => {
  it('un large enemigo intercepta el proyectil; el objetivo de detrás queda a salvo', () => {
    const caster = mk({ id: 'c', playerId: 'player1', type: 'NORMAL', moves: [RANGED] });
    const wall = mk({ id: 'w', playerId: 'player2', type: 'ROCK', size: 'large', hp: 300, maxHp: 300 });
    const target = mk({ id: 't', playerId: 'player2', type: 'NORMAL', hp: 300, maxHp: 300 });
    // caster (0,0), large centro (2,0) → ocupa (1,0),(2,0),(3,0)…; objetivo detrás en (4,0).
    const g = build(caster, [[{ q: 2, r: 0 }, wall], [{ q: 4, r: 0 }, target]]);

    const r = g.cast('player1', { q: 0, r: 0 }, { q: 4, r: 0 }, 0);
    expect(r.ok).toBe(true);
    expect(wall.hp).toBeLessThan(300);   // el coloso recibe el impacto
    expect(target.hp).toBe(300);          // el de detrás, intacto
    const dmg = (r.state.events ?? []).filter((e) => e.kind === 'damage');
    expect(dmg.some((e) => e.pokemonId === 'w')).toBe(true);
    expect(dmg.some((e) => e.pokemonId === 't')).toBe(false);
  });

  it('sin coloso en medio, el objetivo recibe el daño', () => {
    const caster = mk({ id: 'c', playerId: 'player1', type: 'NORMAL', moves: [RANGED] });
    const target = mk({ id: 't', playerId: 'player2', type: 'NORMAL', hp: 300, maxHp: 300 });
    const g = build(caster, [[{ q: 4, r: 0 }, target]]);
    g.cast('player1', { q: 0, r: 0 }, { q: 4, r: 0 }, 0);
    expect(target.hp).toBeLessThan(300);
  });

  it('un large ALIADO no bloquea tu propio disparo (jugabilidad)', () => {
    const caster = mk({ id: 'c', playerId: 'player1', type: 'NORMAL', moves: [RANGED] });
    const ally = mk({ id: 'a', playerId: 'player1', type: 'ROCK', size: 'large', hp: 300, maxHp: 300 });
    const target = mk({ id: 't', playerId: 'player2', type: 'NORMAL', hp: 300, maxHp: 300 });
    const g = build(caster, [[{ q: 2, r: 0 }, ally], [{ q: 4, r: 0 }, target]]);
    g.cast('player1', { q: 0, r: 0 }, { q: 4, r: 0 }, 0);
    expect(target.hp).toBeLessThan(300); // el aliado no intercepta
    expect(ally.hp).toBe(300);
  });
});
