import { FastifyInstance } from 'fastify';
import { AuthController } from '../controllers/AuthController.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/api/auth/login',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email'],
          properties: { email: { type: 'string', maxLength: 254 } },
        },
      },
    },
    AuthController.login
  );

  app.post(
    '/api/auth/register',
    {
      schema: {
        body: {
          type: 'object',
          required: ['token', 'username', 'avatarUrl'],
          properties: {
            token: { type: 'string', maxLength: 64 },
            username: { type: 'string', maxLength: 16 },
            avatarUrl: { type: 'string', maxLength: 128 },
          },
        },
      },
    },
    AuthController.register
  );
}
