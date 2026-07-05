import { FastifyInstance } from 'fastify';
import { AuthController } from '../controllers/AuthController.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // Registro real: Nombre, email, contraseña, edad y Estudiante42.
  app.post(
    '/api/auth/signup',
    {
      schema: {
        body: {
          type: 'object',
          required: ['name', 'email', 'password', 'age'],
          properties: {
            name: { type: 'string', maxLength: 16 },
            email: { type: 'string', maxLength: 254 },
            password: { type: 'string', minLength: 8, maxLength: 128 },
            age: { type: 'integer', minimum: 1, maximum: 120 },
            student42: { type: 'boolean' },
          },
        },
      },
    },
    AuthController.signup
  );

  // Login: email + contraseña (+ código 2FA opcional).
  app.post(
    '/api/auth/login',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', maxLength: 254 },
            password: { type: 'string', maxLength: 128 },
            code: { type: 'string', maxLength: 12 },
          },
        },
      },
    },
    AuthController.login
  );

  app.post('/api/auth/logout', AuthController.logout);

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

  // 2FA (TOTP): generar secreto y activar.
  app.post('/api/auth/2fa/setup', AuthController.twoFactorSetup);
  app.post(
    '/api/auth/2fa/enable',
    {
      schema: {
        body: {
          type: 'object',
          required: ['code'],
          properties: { code: { type: 'string', maxLength: 12 } },
        },
      },
    },
    AuthController.twoFactorEnable
  );

  // Google OAuth callback.
  app.get('/api/auth/google/callback', AuthController.googleCallback);
}
