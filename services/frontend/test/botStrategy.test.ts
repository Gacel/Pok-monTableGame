import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { decideBotAction, hexDistance } from '../src/controllers/botStrategy';
import type { BotPieceOptions, EnemyPiece } from '../src/controllers/botStrategy';
import type { Hex, Pokemon, PokemonType } from '@transcendence/shared';

/**
 * Tests de la IA del bot local (lógica PURA). Cubre los 3 niveles de dificultad,
 * el remate (kill), evitar combates desfavorables (DIFÍCIL) y el fallback codicioso
 * (NORMAL). Ver services/frontend/src/controllers/botStrategy.ts y docs/RESPONSIVE.md
 * (la IA es parte del modo un jugador).
 */

const H = (q: number, r: number): Hex => ({ q, r });

/** Pokémon de prueba con lo mínimo que usa la IA (type, hp, maxHp, atk/def por defecto). */
function mon(type: string, hp = 100, extra: Partial<Pokemon> = {}): Pokemon {
  return {
    id: 'x',
    playerId: 'p',
    type: type as PokemonType,
    movementPattern: 'TANK' as Pokemon['movementPattern'],
    hp,
    maxHp: 100,
    ...extra,
  };
}

/** rng determinista para tests reproducibles. */
const rng = (v: number) => () => v;

describe('hexDistance', () => {
  it('calcula la distancia hexagonal', () => {
    assert.equal(hexDistance(H(0, 0), H(2, -1)), 2);
    assert.equal(hexDistance(H(0, 0), H(0, 0)), 0);
    assert.equal(hexDistance(H(0, 0), H(-2, 0)), 2);
  });
});

describe('decideBotAction · DIFÍCIL (nivel 3)', () => {
  it('remata cuando puede matar (aunque sea el rival)', () => {
    const piece: BotPieceOptions = {
      from: H(0, 0),
      pokemon: mon('FIRE'),
      moves: [],
      attacks: [{ hex: H(1, 0), target: mon('GRASS', 5) }], // FIRE>GRASS y hp bajo → letal
    };
    const enemies: EnemyPiece[] = [{ hex: H(1, 0), pokemon: mon('GRASS', 5) }];
    const d = decideBotAction([piece], enemies, 3, rng(0));
    assert.equal(d.type, 'attack');
    assert.deepEqual(d, { type: 'attack', from: H(0, 0), to: H(1, 0) });
  });

  it('NO ataca en desventaja no letal y pasa turno si no hay buen movimiento', () => {
    const piece: BotPieceOptions = {
      from: H(0, 0),
      pokemon: mon('FIRE'),
      moves: [], // sin movimiento útil
      attacks: [{ hex: H(1, 0), target: mon('WATER', 100) }], // WATER>FIRE (adv 0.5), no letal
    };
    const enemies: EnemyPiece[] = [{ hex: H(1, 0), pokemon: mon('WATER', 100) }];
    const d = decideBotAction([piece], enemies, 3, rng(0));
    assert.equal(d.type, 'end');
  });

  it('se posiciona hacia el rival al que gana por tipo', () => {
    const piece: BotPieceOptions = {
      from: H(0, 0),
      pokemon: mon('FIRE'),
      moves: [H(1, 0), H(0, 1)], // (1,0) acerca al GRASS lejano
      attacks: [], // sin ataques disponibles → decide moverse
    };
    const enemies: EnemyPiece[] = [
      { hex: H(3, 0), pokemon: mon('GRASS') }, // FIRE gana → objetivo preferido pese a lejanía
      { hex: H(-1, 0), pokemon: mon('WATER') }, // más cerca pero desfavorable
    ];
    const d = decideBotAction([piece], enemies, 3, rng(0));
    assert.equal(d.type, 'move');
    assert.deepEqual((d as { to: Hex }).to, H(1, 0));
  });
});

describe('decideBotAction · NORMAL (nivel 2)', () => {
  it('ataca cuando es favorable', () => {
    const piece: BotPieceOptions = {
      from: H(0, 0),
      pokemon: mon('FIRE'),
      moves: [],
      attacks: [{ hex: H(1, 0), target: mon('GRASS', 100) }], // FIRE>GRASS (adv 1.5)
    };
    const enemies: EnemyPiece[] = [{ hex: H(1, 0), pokemon: mon('GRASS', 100) }];
    const d = decideBotAction([piece], enemies, 2, rng(0));
    assert.equal(d.type, 'attack');
  });

  it('ataca aunque sea desfavorable si no puede avanzar (codicioso)', () => {
    const piece: BotPieceOptions = {
      from: H(0, 0),
      pokemon: mon('FIRE'),
      moves: [], // no puede moverse
      attacks: [{ hex: H(1, 0), target: mon('WATER', 100) }], // desfavorable, no letal
    };
    const enemies: EnemyPiece[] = [{ hex: H(1, 0), pokemon: mon('WATER', 100) }];
    const d = decideBotAction([piece], enemies, 2, rng(0));
    assert.equal(d.type, 'attack'); // a diferencia de DIFÍCIL, NORMAL sí ataca
  });
});

describe('decideBotAction · FÁCIL (nivel 1)', () => {
  it('ataca cuando el azar cae por debajo del umbral (rng<0.6)', () => {
    const piece: BotPieceOptions = {
      from: H(0, 0),
      pokemon: mon('FIRE'),
      moves: [H(1, 0)],
      attacks: [{ hex: H(1, 0), target: mon('WATER', 100) }],
    };
    const d = decideBotAction([piece], [], 1, rng(0));
    assert.equal(d.type, 'attack');
  });

  it('se mueve cuando el azar cae por encima del umbral (rng>=0.6)', () => {
    const piece: BotPieceOptions = {
      from: H(0, 0),
      pokemon: mon('FIRE'),
      moves: [H(1, 0)],
      attacks: [{ hex: H(1, 0), target: mon('WATER', 100) }],
    };
    const d = decideBotAction([piece], [], 1, rng(0.9));
    assert.equal(d.type, 'move');
  });
});

describe('decideBotAction · sin acciones', () => {
  it('pasa turno cuando no hay ni ataques ni movimientos', () => {
    const piece: BotPieceOptions = { from: H(0, 0), pokemon: mon('FIRE'), moves: [], attacks: [] };
    const d = decideBotAction([piece], [], 2, rng(0));
    assert.equal(d.type, 'end');
  });
});

describe('decideBotAction · foco de fuego (rematar heridos)', () => {
  it('prefiere el REMATE aunque sea desfavorable frente a un súper-efectivo no letal', () => {
    const piece: BotPieceOptions = {
      from: H(0, 0),
      pokemon: mon('FIRE'),
      moves: [],
      attacks: [
        { hex: H(0, 1), target: mon('GRASS', 100) }, // súper-efectivo (1.5) pero NO mata
        { hex: H(1, 0), target: mon('WATER', 3) }, // desfavorable (0.5) pero REMATA
      ],
    };
    const enemies: EnemyPiece[] = [
      { hex: H(0, 1), pokemon: mon('GRASS', 100) },
      { hex: H(1, 0), pokemon: mon('WATER', 3) },
    ];
    const d = decideBotAction([piece], enemies, 3, rng(0));
    assert.equal(d.type, 'attack');
    assert.deepEqual((d as { to: Hex }).to, H(1, 0)); // remata al herido
  });
});

describe('decideBotAction · retirada táctica (DIFÍCIL)', () => {
  const piece = (): BotPieceOptions => ({
    from: H(0, 0),
    pokemon: mon('FIRE'),
    moves: [H(-1, 0)], // única opción: alejarse del rival en (2,0)
    attacks: [],
  });
  const enemies: EnemyPiece[] = [{ hex: H(2, 0), pokemon: mon('WATER') }]; // WATER gana a FIRE

  it('DIFÍCIL se aleja del rival fuerte en vez de pasar turno', () => {
    const d = decideBotAction([piece()], enemies, 3, rng(0));
    assert.equal(d.type, 'move');
    assert.deepEqual((d as { to: Hex }).to, H(-1, 0));
  });

  it('NORMAL, en cambio, pasa turno (no se retira)', () => {
    const d = decideBotAction([piece()], enemies, 2, rng(0));
    assert.equal(d.type, 'end');
  });
});

describe('decideBotAction · evitar terreno malo (DIFÍCIL)', () => {
  const grassPiece: BotPieceOptions = {
    from: H(0, 0),
    pokemon: mon('GRASS'),
    moves: [H(4, 0), H(3, 0)], // (4,0) acerca más pero es LAVA; (3,0) es hierba
    attacks: [],
  };
  const enemies: EnemyPiece[] = [{ hex: H(6, 0), pokemon: mon('WATER') }];
  const biomeOf = (h: Hex) => (h.q === 4 && h.r === 0 ? 'FIRE' : 'GRASS'); // (4,0)=lava

  it('evita la lava aunque acerque más al rival', () => {
    const d = decideBotAction([grassPiece], enemies, 3, rng(0), biomeOf);
    assert.equal(d.type, 'move');
    assert.deepEqual((d as { to: Hex }).to, H(3, 0)); // hierba, no lava
  });

  it('sin conocer el terreno (o en niveles bajos) tomaría el avance máximo', () => {
    const d = decideBotAction([grassPiece], enemies, 3, rng(0)); // sin biomeOf
    assert.deepEqual((d as { to: Hex }).to, H(4, 0)); // el que más acerca
  });
});
