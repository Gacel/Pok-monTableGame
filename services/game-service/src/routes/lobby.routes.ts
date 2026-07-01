import { FastifyInstance } from 'fastify';
import { LobbyController } from '../controllers/LobbyController.js';

const roomParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', minLength: 1, maxLength: 64 } },
};

/**
 * Lobby multijugador:
 *   POST   /api/lobby/matches          → crear partida (anfitrión, con nombre)
 *   GET    /api/lobby/matches          → buscar partida (salas abiertas)
 *   GET    /api/lobby/matches/:id      → estado de una sala (rejoin/refresh)
 *   POST   /api/lobby/matches/:id/join → unirse a una sala
 *   POST   /api/lobby/matches/:id/team → enviar equipo del draft
 *   DELETE /api/lobby/matches/:id      → cerrar sala (solo anfitrión)
 */
export async function lobbyRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/api/lobby/matches',
    {
      schema: {
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 32 },
            capacity: { type: 'integer', minimum: 2, maximum: 4 },
            gameMode: { type: 'string', enum: ['ffa', 'teams'] },
          },
        },
      },
    },
    LobbyController.create
  );

  app.get('/api/lobby/matches', LobbyController.list);
  app.get('/api/lobby/matches/:id', { schema: { params: roomParamsSchema } }, LobbyController.get);
  app.post(
    '/api/lobby/matches/:id/join',
    { schema: { params: roomParamsSchema } },
    LobbyController.join
  );
  app.post(
    '/api/lobby/matches/:id/team',
    {
      schema: {
        params: roomParamsSchema,
        body: {
          type: 'object',
          required: ['team'],
          properties: {
            team: { type: 'array', items: { type: 'string', maxLength: 32 }, minItems: 3, maxItems: 3 },
          },
        },
      },
    },
    LobbyController.submitTeam
  );
  app.delete(
    '/api/lobby/matches/:id',
    { schema: { params: roomParamsSchema } },
    LobbyController.cancel
  );
}
