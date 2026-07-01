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
  app.get('/api/game/roster', GameController.getRoster);

  app.post(
    '/api/game/start',
    {
      schema: {
        body: {
          type: 'object',
          required: ['player1', 'player2'],
          properties: {
            player1: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 3 },
            player2: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 3 },
          },
        },
      },
    },
    GameController.start
  );

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

  app.post(
    '/api/game/combat/action',
    {
      schema: {
        body: {
          type: 'object',
          required: ['action'],
          properties: {
            action: { type: 'string', enum: ['ATACAR', 'HABILIDAD', 'OBJETO', 'HUIR', 'MOVE'] },
            moveName: { type: 'string', maxLength: 40 },
          },
        },
      },
    },
    GameController.combatAction
  );

  app.post('/api/game/combat/continue', GameController.combatContinue);

  app.post('/api/game/end-turn', GameController.endTurn);

  app.post('/api/game/abandon', GameController.abandon);

  app.post('/api/game/reset', GameController.reset);
}
