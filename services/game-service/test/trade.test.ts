import { describe, it, expect, beforeAll } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

const TMP_DB = path.join(os.tmpdir(), `t101-trade-${crypto.randomUUID()}.db`);
process.env.GAME_DB_PATH = TMP_DB;

const { getDb } = await import('../src/models/db.js');
const { OwnedPokemonModel } = await import('../src/models/OwnedPokemonModel.js');
const { ItemModel } = await import('../src/models/ItemModel.js');
const { UserModel } = await import('../src/models/UserModel.js');
const { TradeService, TradeError } = await import('../src/services/TradeService.js');

async function mkUser(id: string, coins: number): Promise<void> {
  const db = await getDb();
  await db.run('INSERT INTO users (id, username, level, coins) VALUES (?, ?, 1, ?)', id, id, coins);
}
async function befriend(a: string, b: string): Promise<void> {
  const db = await getDb();
  await db.run('INSERT INTO friendships (user_id, friend_id) VALUES (?, ?), (?, ?)', a, b, b, a);
}
async function grant(user: string, name: string): Promise<string> {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.run(
    "INSERT INTO owned_pokemon (id, user_id, name, level, xp, is_starter, is_shiny, acquired_via) VALUES (?, ?, ?, 5, 0, 0, 0, 'test')",
    id, user, name
  );
  return id;
}

describe('T10.1 · intercambio con escrow', () => {
  beforeAll(async () => {
    await mkUser('alice', 1000);
    await mkUser('bob', 1000);
    await mkUser('carol', 0); // no amiga
    await befriend('alice', 'bob');
  });

  it('propose retiene en escrow lo ofertado (fuera del inventario del proponente)', async () => {
    const pikachu = await grant('alice', 'pikachu');
    await ItemModel.add('alice', 'stone', 'fire-stone', 2);
    const t = await TradeService.propose(
      'alice', 'bob',
      { pokemonIds: [pikachu], items: [{ kind: 'stone', itemKey: 'fire-stone', qty: 1 }], coins: 100 },
      { pokemonIds: [], items: [], coins: 0 }
    );
    // Escrow: el Pokémon ya no está en el inventario de alice, y perdió 1 piedra + 100 monedas.
    expect((await OwnedPokemonModel.listByUser('alice')).some((p) => p.id === pikachu)).toBe(false);
    expect(await ItemModel.getQty('alice', 'stone', 'fire-stone')).toBe(1);
    expect((await UserModel.findById('alice'))?.coins).toBe(900);
    expect(t.status).toBe('pending');
  });

  it('solo se puede intercambiar con amigos', async () => {
    await expect(TradeService.propose('alice', 'carol', { pokemonIds: [], items: [], coins: 10 }, {} as never))
      .rejects.toBeInstanceOf(TradeError);
  });

  it('accept cruza las propiedades (offer→receptor, request→proponente)', async () => {
    const aliceMon = await grant('alice', 'bulbasaur');
    const bobMon = await grant('bob', 'squirtle');
    const t = await TradeService.propose(
      'alice', 'bob',
      { pokemonIds: [aliceMon], items: [], coins: 0 },
      { pokemonIds: [bobMon], items: [], coins: 0 }
    );
    await TradeService.accept(t.id, 'bob');
    // El bulbasaur de alice es ahora de bob; el squirtle de bob es de alice.
    expect((await OwnedPokemonModel.findById(aliceMon))?.user_id).toBe('bob');
    expect((await OwnedPokemonModel.findById(bobMon))?.user_id).toBe('alice');
    expect((await OwnedPokemonModel.findById(aliceMon))?.acquired_via).toBe('trade');
  });

  it('solo el destinatario puede aceptar', async () => {
    const mon = await grant('alice', 'charmander');
    const t = await TradeService.propose('alice', 'bob', { pokemonIds: [mon], items: [], coins: 0 }, {} as never);
    await expect(TradeService.accept(t.id, 'alice')).rejects.toBeInstanceOf(TradeError);
    await TradeService.cancel(t.id, 'alice'); // limpieza
  });

  it('cancel devuelve el escrow al proponente', async () => {
    const mon = await grant('alice', 'eevee');
    const coinsBefore = (await UserModel.findById('alice'))!.coins;
    const t = await TradeService.propose('alice', 'bob', { pokemonIds: [mon], items: [], coins: 50 }, {} as never);
    expect((await UserModel.findById('alice'))!.coins).toBe(coinsBefore - 50);
    await TradeService.cancel(t.id, 'bob'); // el destinatario también puede cancelar
    // Devuelto: el Pokémon vuelve al inventario y las monedas se reembolsan.
    expect((await OwnedPokemonModel.listByUser('alice')).some((p) => p.id === mon)).toBe(true);
    expect((await UserModel.findById('alice'))!.coins).toBe(coinsBefore);
  });

  it('no puedes ofertar lo que no tienes libre', async () => {
    await expect(
      TradeService.propose('bob', 'alice', { pokemonIds: ['no-existe'], items: [], coins: 0 }, {} as never)
    ).rejects.toBeInstanceOf(TradeError);
  });
});
