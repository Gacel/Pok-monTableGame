import { describe, it, expect } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import type { MatchStateDTO } from '@transcendence/shared';

// BD temporal aislada (ver ownedTeam.test.ts).
const TMP_DB = path.join(os.tmpdir(), `t82-capture-${crypto.randomUUID()}.db`);
process.env.GAME_DB_PATH = TMP_DB;

const { getDb } = await import('../src/models/db.js');
const { OwnedPokemonModel } = await import('../src/models/OwnedPokemonModel.js');
const { CaptureService } = await import('../src/services/CaptureService.js');

async function grant(userId: string, name: string): Promise<string> {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.run(
    "INSERT INTO owned_pokemon (id, user_id, name, level, xp, is_starter, is_shiny, acquired_via) VALUES (?, ?, ?, 1, 0, 0, 0, 'test')",
    id, userId, name
  );
  return id;
}

type Defeat = MatchStateDTO['defeats'][number];
function state(defeats: Defeat[]): MatchStateDTO {
  return { tiles: [], players: [], status: 'active', winner: null, defeats, eliminated: [], persistent: false } as unknown as MatchStateDTO;
}

describe('T8.2 · CaptureService — captura en Survival', () => {
  const HUMAN = new Map<string, string | null>([['player1', 'u1']]);

  it('el humano captura al SALVAJE que derrota (nueva instancia en su inventario)', async () => {
    const before = await OwnedPokemonModel.countByUser('u1');
    const caps = await CaptureService.resolve(
      'survival', HUMAN,
      state([{ killerSlot: 'player1', victimSlot: 'player2', victimName: 'pidgey' }])
    );
    expect(caps).toEqual([{ slot: 'player1', name: 'pidgey', kind: 'capture' }]);
    const inv = await OwnedPokemonModel.listByUser('u1');
    expect(await OwnedPokemonModel.countByUser('u1')).toBe(before + 1);
    expect(inv.some((p) => p.name === 'pidgey' && p.acquired_via === 'capture')).toBe(true);
  });

  it('NO captura cuando el KO lo hace la IA (killer sin usuario)', async () => {
    const caps = await CaptureService.resolve(
      'survival', HUMAN,
      state([{ killerSlot: 'player2', victimSlot: 'player1', victimOwnedId: 'x', victimName: 'snorlax' }])
    );
    expect(caps).toEqual([]); // la pérdida del humano es T8.3, no una captura
  });

  it('NO captura una instancia PROPIA (solo salvajes sin ownedId)', async () => {
    const owned = await grant('u1', 'charmander');
    const caps = await CaptureService.resolve(
      'survival', HUMAN,
      state([{ killerSlot: 'player1', victimSlot: 'player2', victimOwnedId: owned, victimName: 'charmander' }])
    );
    expect(caps).toEqual([]);
  });

  it('en modos sin captura (ffa) no hace nada', async () => {
    const caps = await CaptureService.resolve(
      'ffa', HUMAN,
      state([{ killerSlot: 'player1', victimSlot: 'player2', victimName: 'rattata' }])
    );
    expect(caps).toEqual([]);
  });
});

describe('T8.2/T8.4 · CaptureService — robo en Battle Royale', () => {
  it('el ganador roba la INSTANCIA rival (transferencia de propiedad)', async () => {
    const victimInst = await grant('u2', 'gyarados');
    const slotUser = new Map<string, string | null>([['player1', 'u1'], ['player2', 'u2']]);
    const caps = await CaptureService.resolve(
      'br', slotUser,
      state([{ killerSlot: 'player1', victimSlot: 'player2', victimOwnedId: victimInst, victimName: 'gyarados' }])
    );
    expect(caps).toEqual([{ slot: 'player1', name: 'gyarados', kind: 'steal' }]);
    // La instancia cambió de dueño.
    expect((await OwnedPokemonModel.findById(victimInst))?.user_id).toBe('u1');
  });
});
