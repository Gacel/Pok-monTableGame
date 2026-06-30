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

async function initPokemon() {
  const fetchHp = async (name: string) => {
    try {
      const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${name}`);
      const data = await res.json();
      const hp = data.stats.find((s: any) => s.stat.name === 'hp')?.base_stat || 100;
      return hp * 2; // Scaled up slightly for gameplay
    } catch(e) {
      return 100;
    }
  };

  const p1Hp = await fetchHp('charmander');
  const p2Hp = await fetchHp('squirtle');
  const p3Hp = await fetchHp('bulbasaur');

  const p1: Pokemon = { id: 'p1', playerId: 'player1', name: 'charmander', type: 'FIRE', movementPattern: 'FLYING', hp: p1Hp, maxHp: p1Hp };
  const p2: Pokemon = { id: 'p2', playerId: 'player2', name: 'squirtle', type: 'WATER', movementPattern: 'TANK', hp: p2Hp, maxHp: p2Hp };
  const p3: Pokemon = { id: 'p3', playerId: 'player3', name: 'bulbasaur', type: 'GRASS', movementPattern: 'SPEEDSTER', hp: p3Hp, maxHp: p3Hp };

  board.setOccupant({ q: 0, r: 0 }, p1);
  board.setOccupant({ q: 2, r: -1 }, p2);
  board.setOccupant({ q: 1, r: 1 }, p3);
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
