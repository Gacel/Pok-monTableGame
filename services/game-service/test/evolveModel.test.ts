import { describe, it, expect } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

const TMP_DB = path.join(os.tmpdir(), `t93-evolve-${crypto.randomUUID()}.db`);
process.env.GAME_DB_PATH = TMP_DB;

const { getDb } = await import('../src/models/db.js');
const { OwnedPokemonModel } = await import('../src/models/OwnedPokemonModel.js');

describe('T9.3 · OwnedPokemonModel.evolve', () => {
  it('cambia la especie conservando id, nivel y XP', async () => {
    const db = await getDb();
    const id = crypto.randomUUID();
    await db.run(
      "INSERT INTO owned_pokemon (id, user_id, name, level, xp, is_starter, is_shiny, acquired_via) VALUES (?, 'u1', 'charmander', 20, 12, 0, 0, 'test')",
      id
    );
    await OwnedPokemonModel.evolve(id, 'charmeleon');
    const rec = await OwnedPokemonModel.findById(id);
    expect(rec?.name).toBe('charmeleon'); // evolucionó
    expect(rec?.id).toBe(id); // misma instancia
    expect(rec?.level).toBe(20); // conserva nivel
    expect(rec?.xp).toBe(12); // conserva XP
  });
});
