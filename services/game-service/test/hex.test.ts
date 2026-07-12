import { describe, it, expect } from 'vitest';
import {
  hexRound,
  hexLineDraw,
  hexDistance,
  axialToCube,
  cubeToAxial,
  type Hex,
} from '../src/engine/hex.js';

const cubeOk = (h: Hex) => h.q + h.r + (-h.q - h.r); // === 0 siempre para un hex entero válido

describe('engine · axial↔cube', () => {
  it('axialToCube produce s = -q-r y cubeToAxial es su inversa', () => {
    const h: Hex = { q: 2, r: -3 };
    const c = axialToCube(h);
    expect(c).toEqual({ q: 2, r: -3, s: 1 });
    expect(c.q + c.r + c.s).toBe(0);
    expect(cubeToAxial(c)).toEqual(h);
  });
});

describe('engine · hexRound', () => {
  it('redondea al hex entero más cercano (puntos inequívocos)', () => {
    expect(hexRound({ q: 0.1, r: -0.1 })).toEqual({ q: 0, r: 0 });
    expect(hexRound({ q: 2.9, r: -1.1 })).toEqual({ q: 3, r: -1 });
    expect(hexRound({ q: -1.1, r: 0.9 })).toEqual({ q: -1, r: 1 });
  });

  it('mantiene el invariante cúbico q+r+s=0 (corrige la coord de mayor error)', () => {
    // Punto ambiguo: la corrección debe garantizar un hex cúbico válido.
    for (const p of [
      { q: 0.5, r: 0.5 },
      { q: 1.5, r: -0.5 },
      { q: -2.4, r: 1.2 },
      { q: 3.3, r: 3.3 },
    ]) {
      const h = hexRound(p);
      expect(Number.isInteger(h.q)).toBe(true);
      expect(Number.isInteger(h.r)).toBe(true);
      expect(cubeOk(h)).toBe(0);
    }
  });

  it('un hex entero se redondea a sí mismo', () => {
    for (const h of [{ q: 0, r: 0 }, { q: 4, r: -2 }, { q: -3, r: 5 }]) {
      expect(hexRound(h)).toEqual(h);
    }
  });
});

describe('engine · hexLineDraw', () => {
  it('a === b devuelve un único hex (el propio A, copia)', () => {
    const a: Hex = { q: 2, r: -1 };
    const line = hexLineDraw(a, { q: 2, r: -1 });
    expect(line).toEqual([{ q: 2, r: -1 }]);
    expect(line[0]).not.toBe(a); // copia, no la misma referencia
  });

  it('línea recta sobre un eje: (0,0)→(3,0)', () => {
    expect(hexLineDraw({ q: 0, r: 0 }, { q: 3, r: 0 })).toEqual([
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      { q: 2, r: 0 },
      { q: 3, r: 0 },
    ]);
  });

  it('diagonal cúbica: (0,0)→(3,-3) avanza por {q:1,r:-1}', () => {
    expect(hexLineDraw({ q: 0, r: 0 }, { q: 3, r: -3 })).toEqual([
      { q: 0, r: 0 },
      { q: 1, r: -1 },
      { q: 2, r: -2 },
      { q: 3, r: -3 },
    ]);
  });

  it('propiedades generales en varias direcciones y longitudes', () => {
    const pairs: [Hex, Hex][] = [
      [{ q: 0, r: 0 }, { q: 5, r: -2 }],
      [{ q: -3, r: 1 }, { q: 2, r: 3 }],
      [{ q: 4, r: 4 }, { q: -1, r: -4 }],
      [{ q: 0, r: 0 }, { q: -4, r: 0 }],
      [{ q: 1, r: -1 }, { q: 1, r: 5 }],
    ];
    for (const [a, b] of pairs) {
      const line = hexLineDraw(a, b);
      // Longitud = distancia + 1 (ambos extremos incluidos).
      expect(line).toHaveLength(hexDistance(a, b) + 1);
      // Extremos correctos.
      expect(line[0]).toEqual(a);
      expect(line[line.length - 1]).toEqual(b);
      // Contigüidad: cada par consecutivo es adyacente (distancia 1).
      for (let i = 1; i < line.length; i++) {
        expect(hexDistance(line[i - 1]!, line[i]!)).toBe(1);
      }
      // Todos los hexes son válidos (cúbicos).
      for (const h of line) expect(cubeOk(h)).toBe(0);
    }
  });

  it('recorrer B→A da la misma cadena de casillas invertida', () => {
    const a: Hex = { q: 0, r: 0 };
    const b: Hex = { q: 4, r: -2 };
    const forward = hexLineDraw(a, b);
    const backward = hexLineDraw(b, a);
    expect(backward).toEqual([...forward].reverse());
  });
});
