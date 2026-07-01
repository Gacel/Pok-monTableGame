import Fastify, { FastifyInstance } from 'fastify';
import { authRoutes } from './routes/auth.routes.js';
import { userRoutes } from './routes/user.routes.js';
import { gameRoutes } from './routes/game.routes.js';

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

  app.register(authRoutes);
  app.register(userRoutes);
  app.register(gameRoutes);

  return app;
}
