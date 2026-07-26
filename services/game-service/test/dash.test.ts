import { describe, it, expect } from 'vitest';
import { Board, Pokemon } from '../src/engine/board.js';
import { GameService } from '../src/services/GameService.js';
import { isDash } from '../src/engine/moveTactics.js';
import type { PlayerResources, PokemonMove } from '@transcendence/shared';

const res = (): PlayerResources => ({ FIRE_CANDY: 0, WATER_CANDY: 0, GRASS_CANDY: 0 });
const mk = (
  over: Partial<Pokemon> & Pick<Pokemon, 'id' | 'playerId' | 'type'>
): Pokemon => ({ hp: 200, maxHp: 200, atk: 40, def: 0, speed: 3, size: 'medium', ...over });

const DASH: PokemonMove = { name: 'extreme-speed', type: 'NORMAL', power: 40, damageClass: 'physical', range: 4, aoe: 'single', dash: true };

function build(caster: Pokemon, extra: [{ q: number; r: number }, Pokemon][]): GameService {
  const board = Board.generateBasic(8);
  board.setOccupant({ q: 0, r: 0 }, caster);
  for (const [hex, p] of extra) board.setOccupant(hex, p);
  return new GameService('t', board, ['player1', 'player2'], 'player1', 1, 'active', null,
    { player1: res(), player2: res() }, []);
}
const occAt = (g: GameService, q: number, r: number) =>
  g.getStateDTO().tiles.find((t) => t.hex.q === q && t.hex.r === r)?.occupant ?? null;

describe('engine · dash (T3.3)', () => {
  it('isDash reconoce los moves curados', () => {
    expect(isDash('extreme-speed')).toBe(true);
    expect(isDash('tackle')).toBe(false);
  });

  it('el atacante se lanza junto al objetivo y lo daña; emite evento dash', () => {
    const caster = mk({ id: 'c', playerId: 'player1', type: 'NORMAL', moves: [DASH] });
    const enemy = mk({ id: 'e', playerId: 'player2', type: 'NORMAL', hp: 200, maxHp: 200 });
    const g = build(caster, [[{ q: 3, r: 0 }, enemy]]); // enemigo a (3,0)
    const r = g.cast('player1', { q: 0, r: 0 }, { q: 3, r: 0 }, 0);
    expect(r.ok).toBe(true);

    expect(occAt(g, 2, 0)?.id).toBe('c'); // aterriza junto al objetivo
    expect(occAt(g, 0, 0)).toBeNull();
    expect(enemy.hp).toBeLessThan(200); // dañado
    const dash = (r.state.events ?? []).filter((e) => e.kind === 'dash' && e.pokemonId === 'c');
    expect(dash).toHaveLength(1);
    expect(dash[0]!.to).toEqual({ q: 2, r: 0 });
  });

  it('dash a una casilla libre reposiciona al atacante', () => {
    const caster = mk({ id: 'c', playerId: 'player1', type: 'NORMAL', moves: [DASH] });
    const g = build(caster, []);
    g.cast('player1', { q: 0, r: 0 }, { q: 3, r: 0 }, 0);
    expect(occAt(g, 3, 0)?.id).toBe('c'); // llega hasta el destino libre
  });

  it('si mata a lo que embiste, avanza a su casilla', () => {
    const caster = mk({ id: 'c', playerId: 'player1', type: 'NORMAL', atk: 500, moves: [DASH] });
    const weak = mk({ id: 'e', playerId: 'player2', type: 'NORMAL', hp: 1, maxHp: 1 });
    const g = build(caster, [[{ q: 2, r: 0 }, weak]]);
    g.cast('player1', { q: 0, r: 0 }, { q: 2, r: 0 }, 0);
    expect(occAt(g, 2, 0)?.id).toBe('c'); // ocupa la casilla del KO
  });
});
