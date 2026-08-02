import { describe, it, expect } from 'vitest';
import { levelMultiplier, scaleStat, scaledVitals, clampLevel, LEVEL_CAP, xpToNext, applyXp } from '../src/engine/progression.js';

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

describe('engine · progresión — curva de XP y level-up (T6.1)', () => {
  it('xpToNext crece con el nivel y es Infinity en el cap', () => {
    expect(xpToNext(1)).toBe(25);
    expect(xpToNext(2)).toBeGreaterThan(xpToNext(1));
    expect(xpToNext(LEVEL_CAP)).toBe(Infinity);
  });

  it('acumula XP sin subir si no alcanza el umbral', () => {
    expect(applyXp(1, 0, 10)).toEqual({ level: 1, xp: 10, levelsGained: 0 });
  });

  it('sube un nivel al alcanzar el umbral y guarda el resto', () => {
    // Lv.1 necesita 25; con 30 sube a Lv.2 con 5 de sobra.
    expect(applyXp(1, 0, 30)).toEqual({ level: 2, xp: 5, levelsGained: 1 });
  });

  it('resuelve subidas en cascada con un gran golpe de XP', () => {
    // 25 (1→2) + 50 (2→3) = 75 exactos ⇒ Lv.3 con 0.
    const r = applyXp(1, 0, 75);
    expect(r.level).toBe(3);
    expect(r.xp).toBe(0);
    expect(r.levelsGained).toBe(2);
  });

  it('en el cap la XP se congela (no desborda)', () => {
    const r = applyXp(LEVEL_CAP, 0, 99999);
    expect(r.level).toBe(LEVEL_CAP);
    expect(r.xp).toBe(0);
  });
});
