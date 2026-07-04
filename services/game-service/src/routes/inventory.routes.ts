import { FastifyInstance } from 'fastify';
import { InventoryController } from '../controllers/InventoryController.js';

/** Ruta del inventario del usuario. Exige JWT (hook global en app.ts). */
export async function inventoryRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/inventory', InventoryController.get);
}
