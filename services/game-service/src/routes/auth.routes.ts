import { FastifyInstance } from 'fastify';
import { AuthController } from '../controllers/AuthController.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const emailSchema = {
    schema: {
      body: {
        type: 'object',
        required: ['email'],
        properties: { email: { type: 'string', maxLength: 254 } },
      },
    },
  };

  // Registro (crea cuenta) y login (entra a cuenta existente).
  app.post('/api/auth/signup', emailSchema, AuthController.signup);
  app.post('/api/auth/login', emailSchema, AuthController.login);

  // Perfil (nombre + avatar) del usuario autenticado. El id sale del JWT.
  app.post(
    '/api/auth/register',
    {
      schema: {
        body: {
          type: 'object',
          required: ['username', 'avatarUrl'],
          properties: {
            username: { type: 'string', maxLength: 16 },
            avatarUrl: { type: 'string', maxLength: 128 },
          },
        },
      },
    },
    AuthController.register
  );

  // Define Google OAuth callback route
  app.get(
    '/api/auth/google/callback',
    AuthController.googleCallback
  );
}
