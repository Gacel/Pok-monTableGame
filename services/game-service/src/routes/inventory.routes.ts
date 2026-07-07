import { FastifyInstance } from 'fastify';
import { InventoryController } from '../controllers/InventoryController.js';

/** Ruta del inventario del usuario. Exige JWT (hook global en app.ts). */
export async function inventoryRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/inventory', InventoryController.get);

  // Regala un Pokémon propio a un amigo (transferencia de propiedad).
  app.post(
    '/api/inventory/pokemon/:id/gift',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', minLength: 1, maxLength: 64 } },
        },
        body: {
          type: 'object',
          required: ['toUserId'],
          properties: { toUserId: { type: 'string', minLength: 1, maxLength: 64 } },
        },
      },
    },
    InventoryController.gift
  );

  // Abre una bola del inventario (loot como en la tienda → concede un Pokémon).
  app.post(
    '/api/inventory/item/open',
    {
      schema: {
        body: {
          type: 'object',
          required: ['itemKey'],
          properties: { itemKey: { type: 'string', minLength: 1, maxLength: 64 } },
        },
      },
    },
    InventoryController.openBall
  );

  // Regala un objeto (bola) a un amigo.
  app.post(
    '/api/inventory/item/gift',
    {
      schema: {
        body: {
          type: 'object',
          required: ['kind', 'itemKey', 'toUserId'],
          properties: {
            kind: { type: 'string', minLength: 1, maxLength: 32 },
            itemKey: { type: 'string', minLength: 1, maxLength: 64 },
            toUserId: { type: 'string', minLength: 1, maxLength: 64 },
          },
        },
      },
    },
    InventoryController.giftItem
  );
}
