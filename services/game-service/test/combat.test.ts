import { describe, it, expect } from 'vitest';
import { Board, Pokemon } from '../src/engine/board.js';
import {
  typeAdvantage,
  effectiveAtk,
  effectiveDef,
  canEnter,
} from '../src/engine/environment.js';
import { computeDamage, resolveCombat } from '../src/engine/combat.js';
import { getMoveOptions } from '../src/engine/movement.js';

const mk = (over: Partial<Pokemon> & Pick<Pokemon, 'id' | 'playerId' | 'type' | 'movementPattern'>): Pokemon => ({
  hp: 100,
  maxHp: 100,
  atk: 50,
  def: 40,
  ...over,
});

describe('Environment · type advantage', () => {
  it('FIRE beats GRASS, GRASS beats WATER, WATER beats FIRE', () => {
    expect(typeAdvantage('FIRE', 'GRASS')).toBe(1.5);
    expect(typeAdvantage('GRASS', 'WATER')).toBe(1.5);
    expect(typeAdvantage('WATER', 'FIRE')).toBe(1.5);
  });
  it('reverse matchups are weak, same/other are neutral', () => {
    expect(typeAdvantage('GRASS', 'FIRE')).toBe(0.5);
    expect(typeAdvantage('FIRE', 'FIRE')).toBe(1.0);
  });
});

describe('Environment · terrain modifiers', () => {
  it('FIRE terrain gives +20% ATK to FIRE pokemon', () => {
    const p = mk({ id: 'a', playerId: 'p1', type: 'FIRE', movementPattern: 'TANK', atk: 100 });
    expect(effectiveAtk(p, 'FIRE')).toBe(120);
    expect(effectiveAtk(p, 'GRASS')).toBe(100);
  });
  it('FIRE terrain gives -15% DEF to GRASS pokemon', () => {
    const p = mk({ id: 'b', playerId: 'p1', type: 'GRASS', movementPattern: 'TANK', def: 100 });
    expect(effectiveDef(p, 'FIRE')).toBe(85);
    expect(effectiveDef(p, 'WATER')).toBe(100);
  });
  it('FIRE pokemon cannot enter WATER, others can', () => {
    const fire = mk({ id: 'f', playerId: 'p1', type: 'FIRE', movementPattern: 'TANK' });
    const water = mk({ id: 'w', playerId: 'p1', type: 'WATER', movementPattern: 'TANK' });
    expect(canEnter(fire, 'WATER')).toBe(false);
    expect(canEnter(fire, 'FIRE')).toBe(true);
    expect(canEnter(water, 'WATER')).toBe(true);
  });
});

describe('Combat · damage', () => {
  it('is deterministic and at least 1', () => {
    const a = mk({ id: 'a', playerId: 'p1', type: 'FIRE', movementPattern: 'TANK', atk: 50 });
    const d = mk({ id: 'd', playerId: 'p2', type: 'GRASS', movementPattern: 'TANK', def: 40 });
    // atk 50 * 1.5 (fire>grass) = 75 ; def/2 = 20 ; dmg = 55
    expect(computeDamage(a, d, 'GRASS', 'GRASS')).toBe(55);
  });
  it('never goes below 1', () => {
    const weak = mk({ id: 'x', playerId: 'p1', type: 'GRASS', movementPattern: 'TANK', atk: 1 });
    const tank = mk({ id: 'y', playerId: 'p2', type: 'FIRE', movementPattern: 'TANK', def: 999 });
    expect(computeDamage(weak, tank, 'GRASS', 'GRASS')).toBe(1);
  });
});

describe('Combat · resolution', () => {
  it('always ends with exactly one winner and one loser at 0 HP', () => {
    const a = mk({ id: 'a', playerId: 'p1', type: 'FIRE', movementPattern: 'TANK' });
    const b = mk({ id: 'b', playerId: 'p2', type: 'GRASS', movementPattern: 'TANK' });
    const res = resolveCombat(a, b, 'GRASS', 'GRASS');
    expect([a.id, b.id]).toContain(res.winnerId);
    expect(res.winnerId).not.toBe(res.loserId);
    const loser = res.winnerId === a.id ? res.defender : res.attacker;
    expect(loser.hp).toBe(0);
  });
  it('type advantage decides an otherwise even fight (fire beats grass)', () => {
    const fire = mk({ id: 'fire', playerId: 'p1', type: 'FIRE', movementPattern: 'TANK' });
    const grass = mk({ id: 'grass', playerId: 'p2', type: 'GRASS', movementPattern: 'TANK' });
    const res = resolveCombat(fire, grass, 'GRASS', 'GRASS');
    expect(res.winnerId).toBe('fire');
  });
  it('does not mutate the input pokemon', () => {
    const a = mk({ id: 'a', playerId: 'p1', type: 'FIRE', movementPattern: 'TANK' });
    const b = mk({ id: 'b', playerId: 'p2', type: 'GRASS', movementPattern: 'TANK' });
    resolveCombat(a, b, 'GRASS', 'GRASS');
    expect(a.hp).toBe(100);
    expect(b.hp).toBe(100);
  });
});

describe('Movement · attacks', () => {
  it('an adjacent enemy is an attack target, not a move', () => {
    const board = Board.generateBasic(2);
    const tank = mk({ id: 't', playerId: 'p1', type: 'WATER', movementPattern: 'TANK' });
    const enemy = mk({ id: 'e', playerId: 'p2', type: 'GRASS', movementPattern: 'TANK' });
    board.setOccupant({ q: 0, r: 0 }, tank);
    board.setOccupant({ q: 1, r: 0 }, enemy);
    const opts = getMoveOptions({ q: 0, r: 0 }, board);
    expect(opts.attacks.some((h) => h.q === 1 && h.r === 0)).toBe(true);
    expect(opts.moves.some((h) => h.q === 1 && h.r === 0)).toBe(false);
  });

  it('FIRE pokemon cannot move onto water tiles', () => {
    const board = new Board();
    board.setTile({ hex: { q: 0, r: 0 }, biome: 'GRASS', occupant: null });
    // Surround with water
    for (const d of [{ q: 1, r: 0 }, { q: -1, r: 0 }, { q: 0, r: 1 }, { q: 0, r: -1 }, { q: 1, r: -1 }, { q: -1, r: 1 }]) {
      board.setTile({ hex: d, biome: 'WATER', occupant: null });
    }
    const fire = mk({ id: 'f', playerId: 'p1', type: 'FIRE', movementPattern: 'TANK' });
    board.setOccupant({ q: 0, r: 0 }, fire);
    const opts = getMoveOptions({ q: 0, r: 0 }, board);
    expect(opts.moves.length).toBe(0); // all neighbours are water
  });
});
