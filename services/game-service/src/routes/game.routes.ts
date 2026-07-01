import { FastifyInstance } from 'fastify';
import { GameController } from '../controllers/GameController.js';

const hexSchema = {
  type: 'object',
  required: ['q', 'r'],
  properties: { q: { type: 'integer' }, r: { type: 'integer' } },
};

export async function gameRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/game/board', GameController.getBoard);
  app.get('/api/game/state', GameController.getState);
  app.get('/api/game/moves', GameController.getMoveOptions);

  app.post(
    '/api/game/move',
    {
      schema: {
        body: {
          type: 'object',
          required: ['from', 'to'],
          properties: { from: hexSchema, to: hexSchema },
        },
      },
    },
    GameController.move
  );

  app.post('/api/game/reset', GameController.reset);
}
