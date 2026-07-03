import { FastifyInstance } from 'fastify';
import { FriendController } from '../controllers/FriendController.js';

/** Rutas de COMUNIDAD → amigos. Todas exigen JWT (hook global en app.ts). */
export async function friendRoutes(app: FastifyInstance): Promise<void> {
  // Amigos aceptados y sugerencias.
  app.get('/api/friends', FriendController.list);
  app.get('/api/friends/recommended', FriendController.recommended);

  // Solicitudes de amistad (requieren confirmación del receptor).
  app.get('/api/friends/requests', FriendController.incoming);
  app.post(
    '/api/friends/requests',
    {
      schema: {
        body: {
          type: 'object',
          required: ['userId'],
          properties: { userId: { type: 'string', maxLength: 64 } },
        },
      },
    },
    FriendController.request
  );
  app.post('/api/friends/requests/:fromId/accept', FriendController.accept);
  app.post('/api/friends/requests/:fromId/reject', FriendController.reject);
}
