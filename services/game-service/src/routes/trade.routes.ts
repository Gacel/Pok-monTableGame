import { FastifyInstance } from 'fastify';
import { TradeController } from '../controllers/TradeController.js';

/** Rutas de intercambio entre jugadores (T10.1). Exigen JWT (hook global en app.ts). */
export async function tradeRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/trades', TradeController.list);
  app.post(
    '/api/trades',
    {
      schema: {
        body: {
          type: 'object',
          required: ['toUserId'],
          properties: {
            toUserId: { type: 'string', minLength: 1, maxLength: 64 },
            offer: { type: 'object' },
            request: { type: 'object' },
          },
        },
      },
    },
    TradeController.propose
  );

  const idParams = {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', minLength: 1, maxLength: 64 } },
      },
    },
  };
  app.post('/api/trades/:id/accept', idParams, TradeController.accept);
  app.post('/api/trades/:id/cancel', idParams, TradeController.cancel);
}
