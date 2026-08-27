import { describe, it, expect } from 'vitest';
import { Board, Pokemon } from '../src/engine/board.js';
import { GameService } from '../src/services/GameService.js';
import { getKnockback } from '../src/engine/moveTactics.js';
import type { PlayerResources, PokemonMove } from '@transcendence/shared';

const res = (): PlayerResources => ({ FIRE_CANDY: 0, WATER_CANDY: 0, GRASS_CANDY: 0 });
const mk = (
  over: Partial<Pokemon> & Pick<Pokemon, 'id' | 'playerId' | 'type'>
): Pokemon => ({ hp: 200, maxHp: 200, atk: 40, def: 0, speed: 3, size: 'medium', ...over });

const PUSH: PokemonMove = { name: 'dragon-tail', type: 'DRAGON', power: 40, damageClass: 'physical', range: 1, aoe: 'single', knockback: 2 };
const PUSH_RANGED: PokemonMove = { ...PUSH, range: 3 };

/** Tablero activo con caster en (0,0) y ocupantes extra `[hex, pokemon]`. */
function build(caster: Pokemon, extra: [{ q: number; r: number }, Pokemon][]): GameService {
  const board = Board.generateBasic(8);
  board.setOccupant({ q: 0, r: 0 }, caster);
  for (const [hex, p] of extra) board.setOccupant(hex, p);
  return new GameService('t', board, ['player1', 'player2'], 'player1', 1, 'active', null,
    { player1: res(), player2: res() }, []);
}

const occAt = (g: GameService, q: number, r: number) =>
  g.getStateDTO().tiles.find((t) => t.hex.q === q && t.hex.r === r)?.occupant ?? null;

describe('engine · knockback (T3.1)', () => {
  it('getKnockback devuelve los valores curados', () => {
    expect(getKnockback('dragon-tail')).toBe(2);
    expect(getKnockback('tackle')).toBeUndefined();
  });

  it('empuja al defensor N hexes en la dirección atacante→defensor y emite evento', () => {
    const caster = mk({ id: 'c', playerId: 'player1', type: 'DRAGON', moves: [PUSH] });
    const victim = mk({ id: 'v', playerId: 'player2', type: 'NORMAL' });
    const g = build(caster, [[{ q: 1, r: 0 }, victim]]); // empuje hacia +q
    const r = g.cast('player1', { q: 0, r: 0 }, { q: 1, r: 0 }, 0);
    expect(r.ok).toBe(true);
    expect(occAt(g, 3, 0)?.id).toBe('v'); // (1,0) + 2·(1,0) = (3,0)
    expect(occAt(g, 1, 0)).toBeNull();
    const kb = (r.state.events ?? []).filter((e) => e.kind === 'knockback' && e.pokemonId === 'v');
    expect(kb).toHaveLength(1);
    expect(kb[0]!.to).toEqual({ q: 3, r: 0 });
  });

  it('si choca (pieza detrás) se detiene y recibe 10% maxHp de colisión', () => {
    const caster = mk({ id: 'c', playerId: 'player1', type: 'DRAGON', moves: [PUSH] });
    const victim = mk({ id: 'v', playerId: 'player2', type: 'NORMAL', hp: 200, maxHp: 200 });
    const wall = mk({ id: 'w', playerId: 'player2', type: 'ROCK' });
    const g = build(caster, [[{ q: 1, r: 0 }, victim], [{ q: 2, r: 0 }, wall]]);
    const before = victim.hp;
    g.cast('player1', { q: 0, r: 0 }, { q: 1, r: 0 }, 0);
    expect(occAt(g, 1, 0)?.id).toBe('v'); // bloqueado en el 1er paso, no se mueve
    // Daño directo + colisión (10% de 200 = 20).
    expect(before - victim.hp).toBeGreaterThan(20);
  });

  it('un defensor Large es inmune al empuje', () => {
    const caster = mk({ id: 'c', playerId: 'player1', type: 'DRAGON', moves: [PUSH_RANGED] });
    const big = mk({ id: 'v', playerId: 'player2', type: 'NORMAL', size: 'large' });
    const g = build(caster, [[{ q: 3, r: 0 }, big]]); // centro (3,0), no solapa (0,0)
    g.cast('player1', { q: 0, r: 0 }, { q: 3, r: 0 }, 0);
    expect(occAt(g, 3, 0)?.id).toBe('v'); // no se movió (inmune)
  });
});
