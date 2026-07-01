import Fastify, { FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import { authRoutes } from './routes/auth.routes.js';
import { userRoutes } from './routes/user.routes.js';
import { gameRoutes } from './routes/game.routes.js';
import { lobbyRoutes } from './routes/lobby.routes.js';
import { wsRoutes } from './routes/ws.routes.js';

const SERVICE = 'game-service';

/**
 * Construye la instancia Fastify con todas las rutas registradas.
 * Separado de `server.ts` para poder testear la app sin abrir un puerto.
 */
export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? 'info' },
  });

  app.get('/health', async () => ({ status: 'ok', service: SERVICE }));

  app.register(websocket);
  app.register(authRoutes);
  app.register(userRoutes);
  app.register(gameRoutes);
  app.register(lobbyRoutes);
  app.register(wsRoutes);

  return app;
}
