import { describe, it, expect } from 'vitest';
import { sizeForSpecies, visualScale } from '../src/engine/sizes.js';

describe('engine · sizeForSpecies — footprint táctico (T4.8)', () => {
  it('la lista curada de colosos (8) es large', () => {
    for (const n of ['onix', 'gyarados', 'dragonite', 'kangaskhan', 'snorlax', 'venusaur', 'exeggutor', 'golem']) {
      expect(sizeForSpecies(n), n).toBe('large');
    }
  });

  it('Lapras/Charizard/Mewtwo NO son colosos (medium)', () => {
    for (const n of ['lapras', 'charizard', 'mewtwo', 'aerodactyl', 'rhydon']) {
      expect(sizeForSpecies(n), n).not.toBe('large');
    }
  });

  it('los pequeños clásicos son small', () => {
    for (const n of ['pikachu', 'diglett', 'caterpie', 'magikarp']) {
      expect(sizeForSpecies(n), n).toBe('small');
    }
  });
});

describe('engine · visualScale — escala visual continua (T4.8)', () => {
  it('escala en el rango acotado [0.72, 2.15]', () => {
    for (const n of ['onix', 'snorlax', 'pikachu', 'diglett', 'charizard', 'lapras']) {
      const s = visualScale(n);
      expect(s).toBeGreaterThanOrEqual(0.72);
      expect(s).toBeLessThanOrEqual(2.15);
    }
  });

  it('los enormes escalan más que los pequeños, de forma continua (no en 3 buckets)', () => {
    expect(visualScale('onix')).toBeGreaterThan(visualScale('snorlax'));
    expect(visualScale('snorlax')).toBeGreaterThan(visualScale('charizard'));
    expect(visualScale('charizard')).toBeGreaterThan(visualScale('pikachu'));
    // Lapras se ve grande (aunque su footprint sea medium).
    expect(visualScale('lapras')).toBeGreaterThan(visualScale('charizard'));
  });
});
