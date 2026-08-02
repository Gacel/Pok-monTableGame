import { describe, it, expect } from 'vitest';
import { sizeForSpecies } from '../src/engine/sizes.js';

describe('engine · sizeForSpecies (T4.1)', () => {
  it('los grandes clásicos son large', () => {
    for (const n of ['snorlax', 'lapras', 'onix', 'gyarados', 'dragonite', 'charizard']) {
      expect(sizeForSpecies(n), n).toBe('large');
    }
  });

  it('los pequeños clásicos son small', () => {
    for (const n of ['pikachu', 'clefairy', 'diglett', 'caterpie', 'magikarp']) {
      expect(sizeForSpecies(n), n).toBe('small');
    }
  });

  it('el resto es medium; insensible a mayúsculas', () => {
    expect(sizeForSpecies('kadabra')).toBe('medium');
    expect(sizeForSpecies('Snorlax')).toBe('large');
    expect(sizeForSpecies('PIKACHU')).toBe('small');
  });
});
