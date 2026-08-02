import { describe, it, expect } from 'vitest';
import { parseEvolutionChain, type EvolutionChainResponse } from '../src/engine/evolution.js';

// Charmander → Charmeleon (nivel 16) → Charizard (nivel 36).
const charmanderChain: EvolutionChainResponse = {
  chain: {
    species: { name: 'charmander' },
    evolves_to: [
      {
        species: { name: 'charmeleon' },
        evolution_details: [{ trigger: { name: 'level-up' }, min_level: 16, item: null }],
        evolves_to: [
          {
            species: { name: 'charizard' },
            evolution_details: [{ trigger: { name: 'level-up' }, min_level: 36, item: null }],
            evolves_to: [],
          },
        ],
      },
    ],
  },
};

// Vulpix → Ninetales (piedra fuego).
const vulpixChain: EvolutionChainResponse = {
  chain: {
    species: { name: 'vulpix' },
    evolves_to: [
      {
        species: { name: 'ninetales' },
        evolution_details: [{ trigger: { name: 'use-item' }, item: { name: 'fire-stone' }, min_level: null }],
        evolves_to: [],
      },
    ],
  },
};

// Kadabra → Alakazam (intercambio).
const kadabraChain: EvolutionChainResponse = {
  chain: {
    species: { name: 'abra' },
    evolves_to: [
      {
        species: { name: 'kadabra' },
        evolution_details: [{ trigger: { name: 'level-up' }, min_level: 16 }],
        evolves_to: [
          {
            species: { name: 'alakazam' },
            evolution_details: [{ trigger: { name: 'trade' } }],
            evolves_to: [],
          },
        ],
      },
    ],
  },
};

describe('engine · parseEvolutionChain (T5.2)', () => {
  it('nivel: Charmander → Charmeleon a nivel 16', () => {
    expect(parseEvolutionChain(charmanderChain, 'charmander'))
      .toEqual({ evolvesTo: 'charmeleon', trigger: 'level', minLevel: 16 });
  });

  it('piedra: Vulpix → Ninetales con fire-stone', () => {
    expect(parseEvolutionChain(vulpixChain, 'vulpix'))
      .toEqual({ evolvesTo: 'ninetales', trigger: 'stone', item: 'fire-stone' });
  });

  it('intercambio: Kadabra → Alakazam por trade', () => {
    expect(parseEvolutionChain(kadabraChain, 'kadabra'))
      .toEqual({ evolvesTo: 'alakazam', trigger: 'trade' });
  });

  it('forma final o inexistente → null', () => {
    expect(parseEvolutionChain(charmanderChain, 'charizard')).toBeNull(); // final
    expect(parseEvolutionChain(vulpixChain, 'tauros')).toBeNull(); // no está en la cadena
  });
});
