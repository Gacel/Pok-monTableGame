import { FastifyInstance } from 'fastify';
import { FriendController } from '../controllers/FriendController.js';

/** Rutas de COMUNIDAD → amigos. Todas exigen JWT (hook global en app.ts). */
export async function friendRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/friends', FriendController.list);
  app.get('/api/friends/recommended', FriendController.recommended);
  app.post(
    '/api/friends',
    {
      schema: {
        body: {
          type: 'object',
          required: ['userId'],
          properties: { userId: { type: 'string', maxLength: 64 } },
        },
      },
    },
    FriendController.add
  );
}
