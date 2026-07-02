import Fastify, { FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import oauthPlugin from '@fastify/oauth2';
import { authRoutes } from './routes/auth.routes.js';
import { userRoutes } from './routes/user.routes.js';
import { gameRoutes } from './routes/game.routes.js';
import { lobbyRoutes } from './routes/lobby.routes.js';
import { wsRoutes } from './routes/ws.routes.js';

const SERVICE = 'game-service';

/**
 * Construye la instancia Fastify con todas las rutas registradas.
 * Separado de `server.ts` para poder testear la app sin abrir un puerto.
 */
export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? 'info' },
  });

  app.get('/health', async () => ({ status: 'ok', service: SERVICE }));

  app.register(websocket);

  // Register Google OAuth2 if credentials are provided
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    app.register(oauthPlugin, {
      name: 'googleOAuth2',
      credentials: {
        client: {
          id: process.env.GOOGLE_CLIENT_ID,
          secret: process.env.GOOGLE_CLIENT_SECRET
        },
        auth: oauthPlugin.GOOGLE_CONFIGURATION
      },
      startRedirectPath: '/api/auth/google/login',
      callbackUri: `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/api/auth/google/callback`,
      scope: ['profile', 'email']
    });
  }

  app.register(authRoutes);
  app.register(userRoutes);
  app.register(gameRoutes);
  app.register(lobbyRoutes);
  app.register(wsRoutes);

  return app;
}
