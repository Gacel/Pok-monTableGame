import { FastifyInstance } from 'fastify';
import { ShopController } from '../controllers/ShopController.js';

/** Rutas de la tienda (pokéballs). Exigen JWT (hook global en app.ts). */
export async function shopRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/shop/balls', ShopController.balls);
  app.post(
    '/api/shop/ball',
    {
      schema: {
        body: {
          type: 'object',
          required: ['ball'],
          properties: { ball: { type: 'string', maxLength: 16 } },
        },
      },
    },
    ShopController.buy
  );
  app.get('/api/shop/stones', ShopController.stones);
  app.post(
    '/api/shop/stone',
    {
      schema: {
        body: {
          type: 'object',
          required: ['stone'],
          properties: {
            stone: { type: 'string', maxLength: 24 },
            qty: { type: 'integer', minimum: 1, maximum: 99 },
          },
        },
      },
    },
    ShopController.buyStone
  );
  app.post(
    '/api/shop/rare-candy',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            qty: { type: 'integer', minimum: 1, maximum: 99 },
          },
        },
      },
    },
    ShopController.buyCandy
  );
  app.post(
    '/api/inventory/pokemon/:id/use-candy',
    { schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } } },
    ShopController.useCandy
  );
  app.get('/api/shop/lost-pokemon', ShopController.listLostPokemon);
  app.post(
    '/api/shop/recover-pokemon',
    {
      schema: {
        body: {
          type: 'object',
          properties: { id: { type: 'string', maxLength: 64 } },
        },
      },
    },
    ShopController.recoverPokemon
  );
}
