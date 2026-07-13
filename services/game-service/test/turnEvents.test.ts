import { describe, it, expect } from 'vitest';
import { Board, Pokemon } from '../src/engine/board.js';
import { GameService } from '../src/services/GameService.js';
import type { PlayerResources, PokemonMove } from '@transcendence/shared';

const res = (): PlayerResources => ({ FIRE_CANDY: 0, WATER_CANDY: 0, GRASS_CANDY: 0 });

const mk = (
  over: Partial<Pokemon> & Pick<Pokemon, 'id' | 'playerId' | 'type'>
): Pokemon => ({ hp: 100, maxHp: 100, atk: 50, def: 40, speed: 3, size: 'medium', ...over });

const TACKLE: PokemonMove = {
  name: 'tackle',
  type: 'NORMAL',
  power: 40,
  damageClass: 'physical',
  range: 1,
  aoe: 'single',
};
const RANGED: PokemonMove = { ...TACKLE, name: 'swift', range: 3 };

/** Partida mínima YA activa con dos piezas colocadas (sin fase de despliegue). */
function activeGame(
  caster: Pokemon,
  victim: Pokemon,
  casterHex = { q: 0, r: 0 },
  victimHex = { q: 1, r: 0 }
): GameService {
  const board = Board.generateBasic(6);
  board.setOccupant(casterHex, caster);
  board.setOccupant(victimHex, victim);
  return new GameService(
    'test',
    board,
    ['player1', 'player2'],
    'player1',
    1,
    'active',
    null,
    { player1: res(), player2: res() },
    []
  );
}

describe('GameService · canal de eventos de turno (TurnEvent)', () => {
  it('un cast que hace daño emite un evento damage (delta<0, pokemonId, hex)', () => {
    const caster = mk({ id: 'c', playerId: 'player1', type: 'NORMAL', atk: 60, moves: [TACKLE] });
    const victim = mk({ id: 'v', playerId: 'player2', type: 'NORMAL', hp: 500, maxHp: 500, def: 0 });
    const game = activeGame(caster, victim);

    const r = game.cast('player1', { q: 0, r: 0 }, { q: 1, r: 0 }, 0);
    expect(r.ok).toBe(true);

    const dmg = (r.state.events ?? []).filter((e) => e.kind === 'damage');
    expect(dmg).toHaveLength(1);
    expect(dmg[0]!.pokemonId).toBe('v');
    expect(dmg[0]!.delta).toBeLessThan(0);
    expect(dmg[0]!.hex).toEqual({ q: 1, r: 0 });
    expect((r.state.events ?? []).some((e) => e.kind === 'ko')).toBe(false);
  });

  it('un cast que provoca KO emite damage + ko', () => {
    const caster = mk({ id: 'c', playerId: 'player1', type: 'NORMAL', atk: 200, moves: [TACKLE] });
    const victim = mk({ id: 'v', playerId: 'player2', type: 'NORMAL', hp: 1, maxHp: 1, def: 0 });
    const game = activeGame(caster, victim);

    const r = game.cast('player1', { q: 0, r: 0 }, { q: 1, r: 0 }, 0);
    expect(r.ok).toBe(true);
    expect((r.state.events ?? []).some((e) => e.kind === 'damage')).toBe(true);
    const ko = (r.state.events ?? []).filter((e) => e.kind === 'ko');
    expect(ko).toHaveLength(1);
    expect(ko[0]!.pokemonId).toBe('v');
  });

  it('events se resetea entre acciones (los de la acción previa no persisten)', () => {
    const caster = mk({ id: 'c', playerId: 'player1', type: 'NORMAL', atk: 60, moves: [TACKLE] });
    const victim = mk({ id: 'v', playerId: 'player2', type: 'NORMAL', hp: 500, maxHp: 500, def: 0 });
    const game = activeGame(caster, victim);

    const cast = game.cast('player1', { q: 0, r: 0 }, { q: 1, r: 0 }, 0);
    expect((cast.state.events ?? []).some((e) => e.pokemonId === 'v')).toBe(true);
    // Nueva acción: el evento de daño a 'v' de la acción anterior NO debe persistir
    // (endTurn puede generar sus propios eventos, p.ej. daño de lava, pero no los del cast).
    const after = game.endTurn('player1');
    expect((after.state.events ?? []).some((e) => e.pokemonId === 'v')).toBe(false);
  });

  it('niebla + T1.1: un oculto golpeado por AoE se revela; sus eventos pasan a verse para el rival', () => {
    const vHex = { q: 3, r: 0 };
    const caster = mk({ id: 'c', playerId: 'player1', type: 'NORMAL', atk: 30, moves: [RANGED] });
    const victim = mk({
      id: 'v',
      playerId: 'player2',
      type: 'NORMAL',
      hp: 500,
      maxHp: 500,
      def: 0,
      isHidden: true,
    });
    const board = Board.generateBasic(6);
    board.getTile(vHex)!.biome = 'TALL_GRASS';
    board.setOccupant({ q: 0, r: 0 }, caster);
    board.setOccupant(vHex, victim);
    const game = new GameService(
      'fog',
      board,
      ['player1', 'player2'],
      'player1',
      1,
      'active',
      null,
      { player1: res(), player2: res() },
      []
    );

    // Ataque a distancia que daña sin matar → la víctima se DESCUBRE (T1.1).
    const r = game.cast('player1', { q: 0, r: 0 }, vHex, 0);
    expect(r.ok).toBe(true);

    const forOwner = game.getStateDTO('player2'); // dueño del oculto
    const forEnemy = game.getStateDTO('player1'); // rival (atacante)
    // Al revelarse, sus eventos dejan de censurarse: los ve el dueño Y el rival.
    expect((forOwner.events ?? []).some((e) => e.pokemonId === 'v')).toBe(true);
    expect((forEnemy.events ?? []).some((e) => e.pokemonId === 'v')).toBe(true);
    expect((forEnemy.events ?? []).some((e) => e.kind === 'reveal' && e.pokemonId === 'v')).toBe(true);
  });
});
