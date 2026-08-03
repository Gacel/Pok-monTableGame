import { describe, it, expect } from 'vitest';
import { GameService } from '../src/services/GameService.js';
import { Board, Pokemon } from '../src/engine/board.js';
import type { PlayerResources } from '@transcendence/shared';
import type { EvolutionInfo } from '../src/engine/evolution.js';
import type { PokemonTemplate } from '../src/models/PokemonModel.js';

const mk = (over: Partial<Pokemon> & Pick<Pokemon, 'id' | 'playerId' | 'type'>): Pokemon => ({
  hp: 100, maxHp: 100, atk: 50, def: 40, speed: 3, size: 'medium', level: 20, name: 'charmander', ...over,
});

/** Partida activa con `caster` en (0,0) y los candies dados a player1. */
function game(caster: Pokemon, fireCandy: number): GameService {
  const board = Board.generateBasic(6);
  board.setOccupant({ q: 0, r: 0 }, caster);
  board.setOccupant({ q: 5, r: 0 }, mk({ id: 'enemy', playerId: 'player2', type: 'NORMAL' }));
  const resources: Record<string, PlayerResources> = {
    player1: { FIRE_CANDY: fireCandy, WATER_CANDY: 0, GRASS_CANDY: 0 },
    player2: { FIRE_CANDY: 0, WATER_CANDY: 0, GRASS_CANDY: 0 },
  };
  return new GameService('t', board, ['player1', 'player2'], 'player1', 1, 'active', null, resources, []);
}

const CHARMELEON: PokemonTemplate = { name: 'charmeleon', hp: 240, maxHp: 240, atk: 64, def: 58, type: 'FIRE', speed: 4, size: 'medium' };
const infoLevel: EvolutionInfo = { evolvesTo: 'charmeleon', trigger: 'level', minLevel: 16 };

describe('GameService.evolvePiece — evolución in-match (T9.4)', () => {
  it('evoluciona gastando candies y sube stats (sin curar)', () => {
    const c = mk({ id: 'c', playerId: 'player1', type: 'FIRE', level: 20, hp: 80, maxHp: 200, atk: 50, def: 40 });
    const g = game(c, 4);
    const r = g.evolvePiece('player1', { q: 0, r: 0 }, infoLevel, CHARMELEON);
    expect(r.ok).toBe(true);
    expect(c.name).toBe('charmeleon'); // evolucionó
    expect(c.atk).toBeGreaterThan(50); // stats subidas por la plantilla destino
    expect(c.maxHp).toBeGreaterThan(200);
    expect(c.hp).toBeLessThanOrEqual(c.maxHp); // no cura por encima del tope
    expect(c.hasActed).toBe(true); // consume la acción del turno
    expect(g.getStateDTO().resources?.player1?.FIRE_CANDY).toBe(0); // gastó 4 candies
  });

  it('rechaza si no hay candies suficientes', () => {
    const c = mk({ id: 'c', playerId: 'player1', type: 'FIRE', level: 20 });
    const r = game(c, 1).evolvePiece('player1', { q: 0, r: 0 }, infoLevel, CHARMELEON);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/caramelos/i);
  });

  it('las evoluciones por nivel exigen el nivel mínimo', () => {
    const c = mk({ id: 'c', playerId: 'player1', type: 'FIRE', level: 10 });
    const r = game(c, 4).evolvePiece('player1', { q: 0, r: 0 }, infoLevel, CHARMELEON);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/nivel/i);
  });

  it('no puedes evolucionar la pieza de otro / fuera de tu turno', () => {
    const c = mk({ id: 'c', playerId: 'player1', type: 'FIRE', level: 20 });
    const r = game(c, 4).evolvePiece('player2', { q: 0, r: 0 }, infoLevel, CHARMELEON);
    expect(r.ok).toBe(false);
  });

  it('una piedra/intercambio no exige nivel (solo candies)', () => {
    const c = mk({ id: 'v', playerId: 'player1', type: 'FIRE', level: 3 });
    const infoStone: EvolutionInfo = { evolvesTo: 'charmeleon', trigger: 'stone', item: 'fire-stone' };
    const r = game(c, 4).evolvePiece('player1', { q: 0, r: 0 }, infoStone, CHARMELEON);
    expect(r.ok).toBe(true); // nivel 3 pero es por piedra → candies bastan
  });
});
