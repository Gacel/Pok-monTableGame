import Fastify from 'fastify';
import { Board, Pokemon } from './engine/board.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MapLoader, TiledMapData } from './engine/mapLoader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? '0.0.0.0';
const SERVICE = 'game-service';

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
});

// Cargar mapa Tiled en lugar de generarlo
const mapPath = path.join(__dirname, '../data/sample_map.json');
const mapData: TiledMapData = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
const board = MapLoader.loadTiledMap(mapData);

import { getDb } from './database.js';

async function loadPokemonData(name: string): Promise<Pokemon> {
  const db = await getDb();
  
  // Try to load from DB
  const row = await db.get('SELECT * FROM pokemons WHERE name = ?', name);
  if (row) {
    console.log(`[DB] Loaded ${name} from SQLite database`);
    return {
      id: '', // Will be assigned per player
      playerId: '',
      name: row.name,
      hp: row.hp,
      maxHp: row.maxHp,
      type: row.type as any,
      movementPattern: row.movementPattern as any
    };
  }

  // Not in DB, fetch from PokeAPI
  console.log(`[API] Fetching ${name} from PokeAPI...`);
  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${name}`);
    const data = await res.json();
    
    const baseHp = data.stats.find((s: any) => s.stat.name === 'hp')?.base_stat || 100;
    const hp = baseHp * 2; // Scaled up slightly for gameplay
    
    let type = 'GRASS';
    const primaryType = data.types?.[0]?.type?.name?.toUpperCase();
    if (['FIRE', 'WATER', 'GRASS'].includes(primaryType)) {
      type = primaryType;
    }

    let pattern = 'TANK';
    if (type === 'FIRE') pattern = 'FLYING';
    if (type === 'GRASS') pattern = 'SPEEDSTER';

    // Save to DB
    await db.run(
      `INSERT INTO pokemons (name, hp, maxHp, type, movementPattern, raw_data) VALUES (?, ?, ?, ?, ?, ?)`,
      [name, hp, hp, type, pattern, JSON.stringify(data)]
    );
    console.log(`[DB] Saved ${name} to SQLite database`);

    return {
      id: '',
      playerId: '',
      name,
      hp,
      maxHp: hp,
      type: type as any,
      movementPattern: pattern as any
    };
  } catch (e) {
    console.error(`Failed to fetch ${name}`, e);
    // Fallback dummy
    return { id: '', playerId: '', name, hp: 200, maxHp: 200, type: 'GRASS', movementPattern: 'TANK' };
  }
}

async function initPokemon() {
  const p1Base = await loadPokemonData('charmander');
  const p2Base = await loadPokemonData('squirtle');
  const p3Base = await loadPokemonData('bulbasaur');

  const p1: Pokemon = { ...p1Base, id: 'p1', playerId: 'player1' };
  // Swap squirtle and bulbasaur to match previous logic (p2=bulba, p3=squirtle)
  const p2: Pokemon = { ...p3Base, id: 'p2', playerId: 'player2' };
  const p3: Pokemon = { ...p2Base, id: 'p3', playerId: 'player3' };

  board.setOccupant({ q: 0, r: 0 }, p1);
  board.setOccupant({ q: 1, r: 1 }, p2);
  board.setOccupant({ q: 2, r: 2 }, p3);
}

// Inicializar y luego arrancar servidor
initPokemon().then(async () => {
  app.get('/health', async () => ({
  status: 'ok',
  service: SERVICE
}));

// Endpoint para el MVP Frontend
app.get('/api/game/board', async () => {
  return board.serialize();
});

// Endpoint para mover Pokémon
app.post('/api/game/move', async (request, reply) => {
  const { from, to } = request.body as any;
  if (!from || !to) {
    return reply.status(400).send({ error: 'Missing from/to hex coordinates' });
  }

  const success = board.moveOccupant(from, to);
  if (!success) {
    return reply.status(400).send({ error: 'Invalid move' });
  }

  return { success: true, board: board.serialize() };
});

// Graceful shutdown
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, async () => {
    app.log.info(`${signal} recibido, cerrando…`);
    await app.close();
    process.exit(0);
  });
}

try {
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`[${SERVICE}] escuchando en http://${HOST}:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

}).catch(err => {
  console.error("Error initializing pokemon:", err);
  process.exit(1);
});
