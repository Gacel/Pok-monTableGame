import { FastifyInstance } from 'fastify';
import { UserController } from '../controllers/UserController.js';

export async function userRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/users/me', UserController.me);
}
