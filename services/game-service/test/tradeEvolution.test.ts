import { describe, it, expect, beforeAll } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

const TMP_DB = path.join(os.tmpdir(), `t103-tradeevo-${crypto.randomUUID()}.db`);
process.env.GAME_DB_PATH = TMP_DB;

const { getDb } = await import('../src/models/db.js');
const { OwnedPokemonModel } = await import('../src/models/OwnedPokemonModel.js');
const { EvolutionModel } = await import('../src/models/EvolutionModel.js');
const { TradeService } = await import('../src/services/TradeService.js');

async function mkUser(id: string): Promise<void> {
  const db = await getDb();
  await db.run('INSERT INTO users (id, username, level, coins) VALUES (?, ?, 1, 0)', id, id);
}
async function grant(user: string, name: string): Promise<string> {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.run(
    "INSERT INTO owned_pokemon (id, user_id, name, level, xp, is_starter, is_shiny, acquired_via) VALUES (?, ?, ?, 20, 0, 0, 0, 'test')",
    id, user, name
  );
  return id;
}

describe('T10.3 · evoluciones por intercambio', () => {
  beforeAll(async () => {
    await mkUser('ash');
    await mkUser('gary');
    const db = await getDb();
    await db.run('INSERT INTO friendships (user_id, friend_id) VALUES (?, ?), (?, ?)', 'ash', 'gary', 'gary', 'ash');
    // Pre-cachea el catálogo (evita red): las 4 evoluciones por intercambio de Gen 1.
    await EvolutionModel.save('kadabra', { evolvesTo: 'alakazam', trigger: 'trade' });
    await EvolutionModel.save('machoke', { evolvesTo: 'machamp', trigger: 'trade' });
    await EvolutionModel.save('pikachu', { evolvesTo: 'raichu', trigger: 'stone', item: 'thunder-stone' });
  });

  it('un Kadabra intercambiado se convierte en Alakazam para quien lo recibe', async () => {
    const kadabra = await grant('ash', 'kadabra');
    const t = await TradeService.propose('ash', 'gary', { pokemonIds: [kadabra], items: [], coins: 0 }, { pokemonIds: [], items: [], coins: 0 });
    await TradeService.accept(t.id, 'gary');
    const rec = await OwnedPokemonModel.findById(kadabra);
    expect(rec?.user_id).toBe('gary'); // lo recibió Gary
    expect(rec?.name).toBe('alakazam'); // y evolucionó por intercambio
  });

  it('funciona en el lado pedido (request) también: Machoke → Machamp', async () => {
    const machoke = await grant('gary', 'machoke');
    // Ash ofrece nada y pide el Machoke de Gary; Gary acepta.
    const t = await TradeService.propose('ash', 'gary', { pokemonIds: [], items: [], coins: 0 }, { pokemonIds: [machoke], items: [], coins: 0 });
    await TradeService.accept(t.id, 'gary');
    const rec = await OwnedPokemonModel.findById(machoke);
    expect(rec?.user_id).toBe('ash');
    expect(rec?.name).toBe('machamp');
  });

  it('los que NO evolucionan por intercambio se mantienen (Pikachu es por piedra)', async () => {
    const pikachu = await grant('ash', 'pikachu');
    const t = await TradeService.propose('ash', 'gary', { pokemonIds: [pikachu], items: [], coins: 0 }, { pokemonIds: [], items: [], coins: 0 });
    await TradeService.accept(t.id, 'gary');
    expect((await OwnedPokemonModel.findById(pikachu))?.name).toBe('pikachu'); // sin cambio
  });
});
