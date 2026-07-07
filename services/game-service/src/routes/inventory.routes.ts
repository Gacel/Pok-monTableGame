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
}
