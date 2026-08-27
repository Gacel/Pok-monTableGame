import { describe, it, expect, beforeAll } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

// BD temporal AISLADA: se fija GAME_DB_PATH antes de importar los módulos que abren la BD
// (db.js cachea la conexión al primer getDb, así que el env debe estar puesto ya). vitest
// aísla cada fichero de test, así que este path no colisiona con otras suites.
const TMP_DB = path.join(os.tmpdir(), `t63-owned-${crypto.randomUUID()}.db`);
process.env.GAME_DB_PATH = TMP_DB;

const { getDb } = await import('../src/models/db.js');
const { OwnedPokemonModel } = await import('../src/models/OwnedPokemonModel.js');

/** Inserta una instancia y devuelve su id. */
async function grant(userId: string, name: string, level: number): Promise<string> {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.run(
    'INSERT INTO owned_pokemon (id, user_id, name, level, is_starter, is_shiny, acquired_via) VALUES (?, ?, ?, ?, 0, 0, ?)',
    id, userId, name, level, 'test'
  );
  return id;
}

describe('T6.3 · equipos por instancia (ownedId): propiedad y carga', () => {
  let u1a: string, u1b: string, u2: string;

  beforeAll(async () => {
    u1a = await grant('u1', 'pikachu', 3);
    u1b = await grant('u1', 'pidgey', 7);
    u2 = await grant('u2', 'bulbasaur', 5);
  });

  it('findManyByIds conserva el orden pedido y trae el nivel real', async () => {
    const rows = await OwnedPokemonModel.findManyByIds([u1b, u1a]);
    expect(rows.map((r) => r.name)).toEqual(['pidgey', 'pikachu']);
    expect(rows.map((r) => r.level)).toEqual([7, 3]);
  });

  it('findManyByIds omite ids inexistentes', async () => {
    const rows = await OwnedPokemonModel.findManyByIds([u1a, 'no-existe']);
    expect(rows.map((r) => r.id)).toEqual([u1a]);
  });

  it('allOwnedBy: true solo si TODAS son instancias libres del usuario', async () => {
    expect(await OwnedPokemonModel.allOwnedBy('u1', [u1a, u1b])).toBe(true);
    expect(await OwnedPokemonModel.allOwnedBy('u1', [u1a, u2])).toBe(false); // u2 es de otro
    expect(await OwnedPokemonModel.allOwnedBy('u1', [u1a, 'no-existe'])).toBe(false);
    expect(await OwnedPokemonModel.allOwnedBy('u1', [])).toBe(false); // equipo vacío
  });

  it('allOwnedBy: una instancia en subasta (escrow) NO es utilizable', async () => {
    await OwnedPokemonModel.setAuction(u1a, 'auction-1');
    expect(await OwnedPokemonModel.allOwnedBy('u1', [u1a, u1b])).toBe(false);
    await OwnedPokemonModel.setAuction(u1a, null); // libera para no afectar a otros asserts
    expect(await OwnedPokemonModel.allOwnedBy('u1', [u1a, u1b])).toBe(true);
  });
});
