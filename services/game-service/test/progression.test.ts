import { describe, it, expect } from 'vitest';
import { levelMultiplier, scaleStat, scaledVitals, clampLevel, LEVEL_CAP } from '../src/engine/progression.js';

describe('engine · progresión — escalado de stats por nivel (T6.2)', () => {
  it('a nivel 1 el multiplicador es 1 (draft/roster intactos)', () => {
    expect(levelMultiplier(1)).toBe(1);
    expect(scaleStat(50, 1)).toBe(50);
  });

  it('un nivel más alto da stats mayores, de forma monótona', () => {
    expect(scaleStat(100, 10)).toBeGreaterThan(scaleStat(100, 1));
    expect(scaleStat(100, 50)).toBeGreaterThan(scaleStat(100, 10));
    expect(scaleStat(100, 100)).toBeGreaterThan(scaleStat(100, 50));
  });

  it('satura en el rango [1, LEVEL_CAP]', () => {
    expect(clampLevel(0)).toBe(1);
    expect(clampLevel(-5)).toBe(1);
    expect(clampLevel(999)).toBe(LEVEL_CAP);
    expect(scaleStat(100, 999)).toBe(scaleStat(100, LEVEL_CAP));
  });

  it('scaledVitals escala hp/maxHp (a tope) y atk/def desde la plantilla', () => {
    const base = { maxHp: 200, atk: 50, def: 40 };
    const v1 = scaledVitals(base, 1);
    expect(v1).toEqual({ hp: 200, maxHp: 200, atk: 50, def: 40 }); // Lv.1 = base

    const v50 = scaledVitals(base, 50);
    expect(v50.hp).toBe(v50.maxHp); // nace con la vida llena
    expect(v50.maxHp).toBeGreaterThan(200);
    expect(v50.atk).toBeGreaterThan(50);
    expect(v50.def).toBeGreaterThan(40);
  });
});
