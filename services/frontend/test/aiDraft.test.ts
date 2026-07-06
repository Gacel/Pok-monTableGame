import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pickAiTeam } from '../src/controllers/aiDraft';
import type { RosterMon } from '../src/controllers/aiDraft';

const mon = (name: string, type: string, s = 50): RosterMon => ({
  name,
  type,
  hp: s,
  atk: s,
  def: s,
});

const rng = (v: number) => () => v;

const roster: RosterMon[] = [
  mon('flareon', 'FIRE'),
  mon('charmander', 'FIRE'),
  mon('vulpix', 'FIRE'),
  mon('squirtle', 'WATER'),
  mon('psyduck', 'WATER'),
  mon('poliwag', 'WATER'),
  mon('bulbasaur', 'GRASS'),
  mon('oddish', 'GRASS'),
  mon('rattata', 'NORMAL'),
];

describe('pickAiTeam', () => {
  it('devuelve 3 y nunca repite Pokémon del equipo del jugador', () => {
    const human = ['flareon', 'charmander', 'vulpix'];
    for (const level of [1, 2, 3] as const) {
      const team = pickAiTeam(roster, human, level, rng(0.3));
      assert.equal(team.length, 3);
      for (const n of team) assert.ok(!human.includes(n), `${n} no debe estar en el equipo humano`);
      assert.equal(new Set(team).size, 3, 'sin duplicados');
    }
  });

  it('DIFÍCIL contrapica por tipo (vs equipo FIRE elige WATER)', () => {
    const human = ['flareon', 'charmander', 'vulpix']; // todo FIRE
    const team = pickAiTeam(roster, human, 3, rng(0));
    const types = team.map((n) => roster.find((p) => p.name === n)!.type);
    // WATER gana a FIRE (1.5) → la IA debe elegir los tres WATER.
    assert.deepEqual(new Set(types), new Set(['WATER']));
  });

  it('FÁCIL es aleatorio pero válido (3 del pool disponible)', () => {
    const human = ['flareon'];
    const team = pickAiTeam(roster, human, 1, rng(0.5));
    assert.equal(team.length, 3);
    for (const n of team) assert.ok(roster.some((p) => p.name === n));
  });
});
