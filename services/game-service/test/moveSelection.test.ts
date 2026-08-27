import { describe, it, expect } from 'vitest';
import { scoreMove, selectMoves, type MoveCandidate } from '../src/engine/moveSelection.js';

const m = (name: string, type: string, power: number, damageClass = 'physical'): MoveCandidate => ({
  name, type, power, damageClass,
});

describe('engine · selección de moves (heurística, TA.2)', () => {
  it('scoreMove: STAB y move emblemático suman sobre la potencia', () => {
    const base = scoreMove(m('x', 'NORMAL', 40), 'FIRE');
    const stab = scoreMove(m('x', 'FIRE', 40), 'FIRE');
    const notable = scoreMove(m('earthquake', 'GROUND', 40), 'FIRE'); // earthquake ∈ MOVE_SHAPES
    expect(stab).toBeGreaterThan(base);
    expect(notable).toBeGreaterThan(base);
  });

  it('prioriza el STAB del Pokémon aunque tenga menos potencia', () => {
    const cands = [
      m('big-normal', 'NORMAL', 90),
      m('stab-fire', 'FIRE', 70),
    ];
    const chosen = selectMoves(cands, 'FIRE', 4).map((c) => c.name);
    expect(chosen).toContain('stab-fire');
  });

  it('variedad: no elige 4 del mismo tipo si hay otros (máx 2 por tipo en la 1ª pasada)', () => {
    const cands = [
      m('f1', 'FIRE', 100), m('f2', 'FIRE', 95), m('f3', 'FIRE', 90), m('f4', 'FIRE', 85),
      m('w1', 'WATER', 60), m('g1', 'GRASS', 55),
    ];
    const chosen = selectMoves(cands, 'FIRE', 4);
    const fireCount = chosen.filter((c) => c.type === 'FIRE').length;
    expect(fireCount).toBeLessThanOrEqual(2);
    expect(chosen.map((c) => c.name)).toEqual(expect.arrayContaining(['w1', 'g1']));
    expect(chosen).toHaveLength(4);
  });

  it('rellena hasta count si un solo tipo domina (2ª pasada sin límite)', () => {
    const cands = [
      m('f1', 'FIRE', 100), m('f2', 'FIRE', 95), m('f3', 'FIRE', 90), m('f4', 'FIRE', 85),
    ];
    const chosen = selectMoves(cands, 'FIRE', 4);
    expect(chosen).toHaveLength(4); // aunque todos sean FIRE, completa
  });

  it('no repite moves por nombre', () => {
    const cands = [m('a', 'FIRE', 50), m('a', 'FIRE', 50), m('b', 'WATER', 40)];
    const chosen = selectMoves(cands, 'FIRE', 4);
    expect(new Set(chosen.map((c) => c.name)).size).toBe(chosen.length);
  });
});
