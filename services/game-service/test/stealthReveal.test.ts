import { describe, it, expect } from 'vitest';
import { Board, Pokemon } from '../src/engine/board.js';
import { GameService } from '../src/services/GameService.js';
import type { PlayerResources, PokemonMove } from '@transcendence/shared';

const res = (): PlayerResources => ({ FIRE_CANDY: 0, WATER_CANDY: 0, GRASS_CANDY: 0 });

const mk = (
  over: Partial<Pokemon> & Pick<Pokemon, 'id' | 'playerId' | 'type'>
): Pokemon => ({ hp: 100, maxHp: 100, atk: 50, def: 40, speed: 3, size: 'medium', ...over });

const RANGED: PokemonMove = {
  name: 'swift',
  type: 'NORMAL',
  power: 40,
  damageClass: 'special',
  range: 3,
  aoe: 'single',
};

/** Partida activa con el atacante en (0,0) y una víctima oculta en hierba a distancia. */
function gameWithHiddenVictim(caster: Pokemon, victim: Pokemon, victimHex = { q: 3, r: 0 }): {
  game: GameService;
  victimHex: { q: number; r: number };
} {
  const board = Board.generateBasic(6);
  board.getTile(victimHex)!.biome = 'TALL_GRASS'; // hierba: se mantiene oculto sin enemigo cerca
  board.setOccupant({ q: 0, r: 0 }, caster);
  board.setOccupant(victimHex, victim);
  const game = new GameService(
    'reveal',
    board,
    ['player1', 'player2'],
    'player1',
    1,
    'active',
    null,
    { player1: res(), player2: res() },
    []
  );
  return { game, victimHex };
}

describe('GameService · revelación por daño AoE (T1.1)', () => {
  it('un AoE que daña (sin matar) a un oculto en hierba lo revela y NO se re-oculta', () => {
    const caster = mk({ id: 'c', playerId: 'player1', type: 'NORMAL', atk: 30, moves: [RANGED] });
    const victim = mk({
      id: 'v', playerId: 'player2', type: 'NORMAL', hp: 500, maxHp: 500, def: 0, isHidden: true,
    });
    const { game, victimHex } = gameWithHiddenVictim(caster, victim);

    const r = game.cast('player1', { q: 0, r: 0 }, victimHex, 0);
    expect(r.ok).toBe(true);

    // Revelado persistente: visible en el DTO del rival (atacante) tras updateStealthVisibility.
    expect(victim.isHidden).toBe(false);
    expect(victim.revealed).toBe(true);
    const forEnemy = game.getStateDTO('player1');
    const seen = forEnemy.tiles.find((t) => t.occupant?.id === 'v');
    expect(seen?.occupant).toBeTruthy();

    // Evento reveal emitido.
    expect((r.state.events ?? []).some((e) => e.kind === 'reveal' && e.pokemonId === 'v')).toBe(true);
  });

  it('la emboscada ×1.5 depende del atacante oculto; revelar a la víctima no la altera', () => {
    const victimHex = { q: 3, r: 0 };
    // Atacante OCULTO (emboscada ×1.5).
    const c1 = mk({ id: 'c', playerId: 'player1', type: 'NORMAL', atk: 60, isHidden: true, moves: [RANGED] });
    const v1 = mk({ id: 'v', playerId: 'player2', type: 'NORMAL', hp: 500, maxHp: 500, def: 0, isHidden: true });
    const g1 = gameWithHiddenVictim(c1, v1, victimHex).game;
    // El atacante oculto también está en hierba para no ser adyacente; su hierba está en (0,0).
    g1.cast('player1', { q: 0, r: 0 }, victimHex, 0);
    const dmgAmbush = 500 - v1.hp;

    // Atacante VISIBLE (sin emboscada).
    const c2 = mk({ id: 'c', playerId: 'player1', type: 'NORMAL', atk: 60, isHidden: false, moves: [RANGED] });
    const v2 = mk({ id: 'v', playerId: 'player2', type: 'NORMAL', hp: 500, maxHp: 500, def: 0, isHidden: true });
    const g2 = gameWithHiddenVictim(c2, v2, victimHex).game;
    g2.cast('player1', { q: 0, r: 0 }, victimHex, 0);
    const dmgNormal = 500 - v2.hp;

    expect(dmgAmbush).toBeGreaterThan(dmgNormal); // ×1.5 solo con atacante oculto
  });

  it('si el AoE mata al oculto, hay ko y no hace falta reveal', () => {
    const caster = mk({ id: 'c', playerId: 'player1', type: 'NORMAL', atk: 200, moves: [RANGED] });
    const victim = mk({ id: 'v', playerId: 'player2', type: 'NORMAL', hp: 1, maxHp: 1, def: 0, isHidden: true });
    const { game, victimHex } = gameWithHiddenVictim(caster, victim);

    const r = game.cast('player1', { q: 0, r: 0 }, victimHex, 0);
    expect((r.state.events ?? []).some((e) => e.kind === 'ko' && e.pokemonId === 'v')).toBe(true);
  });
});
