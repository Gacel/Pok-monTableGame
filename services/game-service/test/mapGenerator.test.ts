import { describe, it, expect } from 'vitest';
import { generateEcosystem } from '../src/engine/mapGenerator.js';
import { hashStringToSeed } from '../src/engine/rng.js';
import type { Biome } from '../src/engine/board.js';

/** Reparto de biomas del mapa procedural para una seed/radio dados. */
function biomeCounts(seed: string, radius: number): Record<string, number> {
  const board = generateEcosystem(hashStringToSeed(seed), { radius });
  const counts: Record<string, number> = {};
  for (const t of board.tiles.values()) counts[t.biome] = (counts[t.biome] ?? 0) + 1;
  return counts;
}

describe('engine · generateEcosystem — cobertura de biomas', () => {
  // Los 8 biomas jugables deben poder aparecer (regresión de T1.0: antes el generador
  // nunca producía TALL_GRASS ni MOUNTAIN, y el sigilo/montaña no tenían terreno).
  const NEW_TERRAINS: Biome[] = ['TALL_GRASS', 'MOUNTAIN', 'SWAMP'];

  it('el mapa normal (r=20, seed por defecto) genera hierba alta, montaña y pantano', () => {
    const counts = biomeCounts('transcendence-default', 20);
    for (const b of NEW_TERRAINS) {
      expect(counts[b] ?? 0, `falta ${b} en el mapa normal`).toBeGreaterThan(0);
    }
  });

  it('el mapa arena (r=42) genera hierba alta, montaña y pantano', () => {
    const counts = biomeCounts('transcendence-default', 42);
    for (const b of NEW_TERRAINS) {
      expect(counts[b] ?? 0, `falta ${b} en la arena`).toBeGreaterThan(0);
    }
  });

  it('sigue generando los biomas base (agua, hierba, fuego)', () => {
    const counts = biomeCounts('transcendence-default', 20);
    for (const b of ['WATER', 'GRASS', 'FIRE'] as Biome[]) {
      expect(counts[b] ?? 0, `falta ${b}`).toBeGreaterThan(0);
    }
  });
});
