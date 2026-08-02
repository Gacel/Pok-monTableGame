import { describe, it, expect } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import type { MatchStateDTO } from '@transcendence/shared';

// BD temporal aislada (ver ownedTeam.test.ts): GAME_DB_PATH antes de importar los módulos.
const TMP_DB = path.join(os.tmpdir(), `t61-xp-${crypto.randomUUID()}.db`);
process.env.GAME_DB_PATH = TMP_DB;

const { getDb } = await import('../src/models/db.js');
const { OwnedPokemonModel } = await import('../src/models/OwnedPokemonModel.js');
const { ProgressionService } = await import('../src/services/ProgressionService.js');

async function grant(userId: string, name: string): Promise<string> {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.run(
    'INSERT INTO owned_pokemon (id, user_id, name, level, xp, is_starter, is_shiny, acquired_via) VALUES (?, ?, ?, 1, 0, 0, 0, ?)',
    id, userId, name, 'test'
  );
  return id;
}

/** Construye un MatchStateDTO mínimo (solo lo que lee awardMatchXp). */
function state(over: Partial<MatchStateDTO>): MatchStateDTO {
  return {
    tiles: [], players: ['player1', 'player2'], status: 'active', winner: null,
    defeats: [], eliminated: [], persistent: false,
    ...over,
  } as unknown as MatchStateDTO;
}
const occTile = (ownedId: string, playerId: string) =>
  ({ hex: { q: 0, r: 0 }, biome: 'GRASS', occupant: { ownedId, playerId } }) as unknown as MatchStateDTO['tiles'][number];

describe('T6.1 · OwnedPokemonModel.addXp — persistencia y level-up', () => {
  it('acumula XP y sube de nivel, persistiendo el resultado', async () => {
    const id = await grant('u1', 'pikachu');
    const r = await OwnedPokemonModel.addXp(id, 30); // Lv.1 necesita 25 ⇒ Lv.2 con 5
    expect(r).toEqual({ level: 2, xp: 5, levelsGained: 1 });
    const rec = await OwnedPokemonModel.findById(id);
    expect(rec?.level).toBe(2);
    expect(rec?.xp).toBe(5);
  });

  it('ignora cantidades no positivas y ids inexistentes', async () => {
    const id = await grant('u1', 'pidgey');
    expect(await OwnedPokemonModel.addXp(id, 0)).toBeNull();
    expect(await OwnedPokemonModel.addXp('no-existe', 30)).toBeNull();
  });
});

describe('T6.1 · ProgressionService.awardMatchXp', () => {
  it('otorga XP por KO a la instancia atacante', async () => {
    const killer = await grant('u1', 'charmander');
    await ProgressionService.awardMatchXp(
      state({ defeats: [{ killerSlot: 'player1', victimSlot: 'player2', killerOwnedId: killer }] })
    );
    expect((await OwnedPokemonModel.findById(killer))?.level).toBe(2); // +30 ⇒ Lv.2
  });

  it('bonus de victoria SOLO a supervivientes del bando ganador, una vez por coloso', async () => {
    const winner = await grant('u1', 'snorlax');
    const loser = await grant('u2', 'magikarp');
    await ProgressionService.awardMatchXp(
      state({
        status: 'finished',
        winner: 'player1',
        // El coloso ganador ocupa DOS casillas (mismo ownedId) → XP una sola vez.
        tiles: [occTile(winner, 'player1'), occTile(winner, 'player1'), occTile(loser, 'player2')],
      })
    );
    // +40 una vez: Lv.1(25)→Lv.2 con 15 sobrantes (no dos veces, que daría Lv.3).
    const w = await OwnedPokemonModel.findById(winner);
    expect(w?.level).toBe(2);
    expect(w?.xp).toBe(15);
    // El perdedor no recibe bonus.
    expect((await OwnedPokemonModel.findById(loser))?.level).toBe(1);
  });
});
