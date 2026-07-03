import { FastifyInstance } from 'fastify';
import { GameController } from '../controllers/GameController.js';
import { OnlineGameController } from '../controllers/OnlineGameController.js';

const hexSchema = {
  type: 'object',
  required: ['q', 'r'],
  properties: { q: { type: 'integer' }, r: { type: 'integer' } },
};

const teamSchema = { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 3 };

const matchParamsSchema = {
  type: 'object',
  required: ['matchId'],
  properties: { matchId: { type: 'string', minLength: 1, maxLength: 64 } },
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
            player1: teamSchema,
            player2: teamSchema,
            player3: teamSchema,
            player4: teamSchema,
            gameMode: { type: 'string', enum: ['ffa', 'teams', 'arena'] },
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
            action: {
              type: 'string',
              enum: ['ATACAR', 'HABILIDAD', 'OBJETO', 'HUIR', 'MOVE', 'TARGET'],
            },
            moveName: { type: 'string', maxLength: 40 },
            targetId: { type: 'string', maxLength: 40 },
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

  // ------------------------- partidas ONLINE (lobby), con matchId + Bearer.
  // Las rutas estáticas de arriba (modo local hot-seat) tienen precedencia
  // sobre `:matchId` en Fastify, así que ambos mundos conviven.
  app.get(
    '/api/game/:matchId/state',
    { schema: { params: matchParamsSchema } },
    OnlineGameController.getState
  );
  app.get(
    '/api/game/:matchId/moves',
    { schema: { params: matchParamsSchema } },
    OnlineGameController.getMoveOptions
  );
  app.post(
    '/api/game/:matchId/move',
    {
      schema: {
        params: matchParamsSchema,
        body: {
          type: 'object',
          required: ['from', 'to'],
          properties: { from: hexSchema, to: hexSchema },
        },
      },
    },
    OnlineGameController.move
  );
  app.post(
    '/api/game/:matchId/combat/action',
    {
      schema: {
        params: matchParamsSchema,
        body: {
          type: 'object',
          required: ['action'],
          properties: {
            action: {
              type: 'string',
              enum: ['ATACAR', 'HABILIDAD', 'OBJETO', 'HUIR', 'MOVE', 'TARGET'],
            },
            moveName: { type: 'string', maxLength: 40 },
            targetId: { type: 'string', maxLength: 40 },
          },
        },
      },
    },
    OnlineGameController.combatAction
  );
  app.post(
    '/api/game/:matchId/combat/continue',
    { schema: { params: matchParamsSchema } },
    OnlineGameController.combatContinue
  );
  app.post(
    '/api/game/:matchId/end-turn',
    { schema: { params: matchParamsSchema } },
    OnlineGameController.endTurn
  );
  app.post(
    '/api/game/:matchId/abandon',
    { schema: { params: matchParamsSchema } },
    OnlineGameController.abandon
  );
}
