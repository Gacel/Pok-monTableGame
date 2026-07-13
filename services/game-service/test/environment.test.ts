import { describe, it, expect } from 'vitest';
import { Board, Pokemon } from '../src/engine/board.js';
import { GameService } from '../src/services/GameService.js';
import { terrainDamage } from '../src/engine/environment.js';
import type { PlayerResources, Biome } from '@transcendence/shared';

const res = (): PlayerResources => ({ FIRE_CANDY: 0, WATER_CANDY: 0, GRASS_CANDY: 0 });

const mk = (
  over: Partial<Pokemon> & Pick<Pokemon, 'id' | 'playerId' | 'type'>
): Pokemon => ({ hp: 100, maxHp: 100, atk: 50, def: 40, speed: 3, size: 'medium', ...over });

/**
 * Partida mínima YA activa con una pieza colocada sobre `biome`. Dos jugadores para
 * que la partida no se dé por terminada al hacer `endTurn` (aún queda el rival).
 */
function activeOnBiome(occ: Pokemon, biome: Biome, hex = { q: 0, r: 0 }): GameService {
  const board = Board.generateBasic(6);
  board.getTile(hex)!.biome = biome;
  board.setOccupant(hex, occ);
  // rival lejano en terreno neutro, para que sobreviva la condición de victoria
  board.setOccupant({ q: 4, r: 0 }, mk({ id: 'enemy', playerId: 'player2', type: 'NORMAL' }));
  return new GameService(
    'test',
    board,
    ['player1', 'player2'],
    'player1',
    1,
    'active',
    null,
    { player1: res(), player2: res() },
    []
  );
}

describe('engine · terrainDamage (lógica pura)', () => {
  it('lava: escala ×2 por turno consecutivo (2^(lavaTurns-1))', () => {
    const p = mk({ id: 'p', playerId: 'player1', type: 'NORMAL' });
    expect(terrainDamage({ ...p, lavaTurns: 1 }, 'FIRE')).toBe(2);
    expect(terrainDamage({ ...p, lavaTurns: 2 }, 'FIRE')).toBe(4);
    expect(terrainDamage({ ...p, lavaTurns: 3 }, 'FIRE')).toBe(8);
  });

  it('lava: Fuego no se quema; Planta/Hielo sufren ×2 de base', () => {
    const fire = mk({ id: 'f', playerId: 'player1', type: 'FIRE', lavaTurns: 1 });
    const grass = mk({ id: 'g', playerId: 'player1', type: 'GRASS', lavaTurns: 1 });
    expect(terrainDamage(fire, 'FIRE')).toBe(0);
    expect(terrainDamage(grass, 'FIRE')).toBe(4);
  });

  it('pantano: 2 de daño tóxico a tipos normales', () => {
    const p = mk({ id: 'p', playerId: 'player1', type: 'NORMAL' });
    expect(terrainDamage(p, 'SWAMP')).toBe(2);
  });

  it('pantano: Veneno y Acero son inmunes (0)', () => {
    const poison = mk({ id: 'po', playerId: 'player1', type: 'POISON' });
    const steel = mk({ id: 'st', playerId: 'player1', type: 'STEEL' });
    expect(terrainDamage(poison, 'SWAMP')).toBe(0);
    expect(terrainDamage(steel, 'SWAMP')).toBe(0);
  });

  it('Volador no toca el suelo: inmune a lava y pantano', () => {
    const flying = mk({ id: 'fl', playerId: 'player1', type: 'FLYING', lavaTurns: 3 });
    expect(terrainDamage(flying, 'FIRE')).toBe(0);
    expect(terrainDamage(flying, 'SWAMP')).toBe(0);
  });

  it('hierba alta: una Planta se cura 8% maxHp (negativo); otros tipos, 0 (T2.2)', () => {
    const grass = mk({ id: 'g', playerId: 'player1', type: 'GRASS', hp: 40, maxHp: 100 });
    const normal = mk({ id: 'n', playerId: 'player1', type: 'NORMAL', maxHp: 100 });
    expect(terrainDamage(grass, 'TALL_GRASS')).toBe(-8); // 8% de 100, curación
    expect(terrainDamage(normal, 'TALL_GRASS')).toBe(0);
  });
});

describe('GameService · efectos de fin de turno (T0.2)', () => {
  it('pantano: un no-Veneno/Acero pierde HP al final del turno y emite damage', () => {
    const victim = mk({ id: 'v', playerId: 'player1', type: 'NORMAL', hp: 50, maxHp: 50 });
    const game = activeOnBiome(victim, 'SWAMP');

    const r = game.endTurn('player1');
    expect(r.ok).toBe(true);
    expect(victim.hp).toBe(48); // 50 - 2 de pantano

    const dmg = (r.state.events ?? []).filter((e) => e.kind === 'damage' && e.pokemonId === 'v');
    expect(dmg).toHaveLength(1);
    expect(dmg[0]!.delta).toBe(-2);
  });

  it('pantano: Veneno NO recibe daño (fix del código muerto sin regresión)', () => {
    const poison = mk({ id: 'po', playerId: 'player1', type: 'POISON', hp: 50, maxHp: 50 });
    const game = activeOnBiome(poison, 'SWAMP');

    game.endTurn('player1');
    expect(poison.hp).toBe(50);
  });

  it('lava: escala ×2 por cada fin de turno consecutivo sobre FIRE', () => {
    // Los efectos de terreno se aplican en cada `endTurn` (sobre todos los ocupantes),
    // así que el daño de lava dobla turno a turno: 2, 4, 8…
    const victim = mk({ id: 'v', playerId: 'player1', type: 'NORMAL', hp: 100, maxHp: 100 });
    const game = activeOnBiome(victim, 'FIRE');

    game.endTurn('player1'); // lavaTurns=1, -2
    expect(victim.hp).toBe(98);
    expect(victim.lavaTurns).toBe(1);
    game.endTurn('player2'); // lavaTurns=2, -4
    expect(victim.hp).toBe(94);
    expect(victim.lavaTurns).toBe(2);
    game.endTurn('player1'); // lavaTurns=3, -8
    expect(victim.hp).toBe(86);
    expect(victim.lavaTurns).toBe(3);
  });

  it('lava fuera: lavaTurns se reinicia al dejar la casilla de FIRE', () => {
    const victim = mk({ id: 'v', playerId: 'player1', type: 'NORMAL', hp: 100, maxHp: 100 });
    const game = activeOnBiome(victim, 'FIRE');
    game.endTurn('player1');
    expect(victim.lavaTurns).toBe(1);
    // Sacarlo de la lava: cambiar el bioma de su casilla y volver a fin de turno
    // (simula que ya no está sobre lava).
    (victim as { lavaTurns?: number }).lavaTurns = 5;
    const board = Board.generateBasic(6);
    board.getTile({ q: 0, r: 0 })!.biome = 'GRASS';
    board.setOccupant({ q: 0, r: 0 }, victim);
    board.setOccupant({ q: 4, r: 0 }, mk({ id: 'enemy', playerId: 'player2', type: 'NORMAL' }));
    const g2 = new GameService(
      'test',
      board,
      ['player1', 'player2'],
      'player1',
      1,
      'active',
      null,
      { player1: res(), player2: res() },
      []
    );
    g2.endTurn('player1');
    expect(victim.lavaTurns).toBe(0);
  });

  it('KO por terreno: cae KO, se retira la pieza y emite ko', () => {
    const victim = mk({ id: 'v', playerId: 'player1', type: 'NORMAL', hp: 2, maxHp: 2 });
    const game = activeOnBiome(victim, 'SWAMP');

    const r = game.endTurn('player1');
    expect(victim.hp).toBeLessThanOrEqual(0);
    const ko = (r.state.events ?? []).filter((e) => e.kind === 'ko' && e.pokemonId === 'v');
    expect(ko).toHaveLength(1);
    // Pieza retirada del tablero.
    const stillOnBoard = (r.state.tiles ?? []).some((t) => t.occupant?.id === 'v');
    expect(stillOnBoard).toBe(false);
  });

  it('invariante de clamp: el HP nunca supera maxHp tras el fin de turno', () => {
    // Con dmg negativo (curación, aún no producida por ningún terreno hasta T2.2) la
    // fórmula clamp = max(0, min(maxHp, hp - dmg)) no permite pasar de maxHp.
    const hp = 30;
    const maxHp = 32;
    const heal = -8; // curación hipotética de 8
    const clamped = Math.max(0, Math.min(maxHp, hp - heal)); // 30 + 8 = 38 -> 32
    expect(clamped).toBe(maxHp);
    expect(clamped).toBeLessThanOrEqual(maxHp);

    // Y una pieza a full HP sobre terreno inocuo no cambia (sin overflow).
    const full = mk({ id: 'v', playerId: 'player1', type: 'NORMAL', hp: 50, maxHp: 50 });
    const game = activeOnBiome(full, 'GRASS');
    game.endTurn('player1');
    expect(full.hp).toBe(50);
    expect(full.hp).toBeLessThanOrEqual(full.maxHp!);
  });

  it('hierba alta: una Planta con HP bajo se cura ~8% y emite heal (T2.2)', () => {
    const grass = mk({ id: 'g', playerId: 'player1', type: 'GRASS', hp: 40, maxHp: 100 });
    const game = activeOnBiome(grass, 'TALL_GRASS');

    const r = game.endTurn('player1');
    expect(grass.hp).toBe(48); // +8

    const heal = (r.state.events ?? []).filter((e) => e.kind === 'heal' && e.pokemonId === 'g');
    expect(heal).toHaveLength(1);
    expect(heal[0]!.delta).toBe(8);
  });

  it('hierba alta: curación clamp a maxHp y sin número fantasma a HP lleno', () => {
    // Cerca del tope: solo recupera lo que falta (2), no 8.
    const nearFull = mk({ id: 'g', playerId: 'player1', type: 'GRASS', hp: 98, maxHp: 100 });
    const g1 = activeOnBiome(nearFull, 'TALL_GRASS');
    const r1 = g1.endTurn('player1');
    expect(nearFull.hp).toBe(100);
    const heal1 = (r1.state.events ?? []).filter((e) => e.kind === 'heal' && e.pokemonId === 'g');
    expect(heal1).toHaveLength(1);
    expect(heal1[0]!.delta).toBe(2); // delta REAL aplicado

    // A HP lleno: sin curación efectiva → sin evento heal (nada de "+N" fantasma).
    const full = mk({ id: 'g2', playerId: 'player1', type: 'GRASS', hp: 100, maxHp: 100 });
    const g2 = activeOnBiome(full, 'TALL_GRASS');
    const r2 = g2.endTurn('player1');
    expect(full.hp).toBe(100);
    expect((r2.state.events ?? []).some((e) => e.kind === 'heal' && e.pokemonId === 'g2')).toBe(false);
  });
});
