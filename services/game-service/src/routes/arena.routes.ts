import { FastifyInstance } from 'fastify';
import { ArenaController } from '../controllers/ArenaController.js';

/** Rutas de ARENA (mundo vivo). Todas exigen JWT (hook global en app.ts). */
export async function arenaRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/arena', ArenaController.get);
  app.post(
    '/api/arena/join',
    {
      schema: {
        body: {
          type: 'object',
          required: ['team'],
          properties: {
            team: { type: 'array', items: { type: 'string', maxLength: 32 }, maxItems: 3 },
          },
        },
      },
    },
    ArenaController.join
  );
  app.post('/api/arena/leave', ArenaController.leave);
}
