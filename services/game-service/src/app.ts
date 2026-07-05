import Fastify, { FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import oauthPlugin from '@fastify/oauth2';
import { authRoutes } from './routes/auth.routes.js';
import { userRoutes } from './routes/user.routes.js';
import { gameRoutes } from './routes/game.routes.js';
import { lobbyRoutes } from './routes/lobby.routes.js';
import { friendRoutes } from './routes/friend.routes.js';
import { arenaRoutes } from './routes/arena.routes.js';
import { starterRoutes } from './routes/starter.routes.js';
import { inventoryRoutes } from './routes/inventory.routes.js';
import { shopRoutes } from './routes/shop.routes.js';
import { wsRoutes } from './routes/ws.routes.js';
import { verifyToken } from './auth/jwt.js';
import { readSessionToken } from './auth/cookie.js';

const SERVICE = 'game-service';

/**
 * Rutas públicas (no exigen JWT): producen el token o son de salud.
 * `/ws` se exime aquí porque su auth se hace dentro del handler (el token viaja
 * en query string, no en header; ver ws.routes.ts).
 */
const PUBLIC_PATHS = new Set<string>([
  '/health',
  '/api/auth/signup',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/google/login',
  '/api/auth/google/callback',
]);

/**
 * Construye la instancia Fastify con todas las rutas registradas.
 * Separado de `server.ts` para poder testear la app sin abrir un puerto.
 */
export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? 'info' },
  });

  app.get('/health', async () => ({ status: 'ok', service: SERVICE }));

  // Hook global de autenticación: exige JWT válido en TODOS los endpoints,
  // salvo los públicos (PUBLIC_PATHS) y /ws (auth propia por query string).
  app.addHook('onRequest', async (request, reply) => {
    const path = request.url.split('?')[0] ?? request.url;
    if (PUBLIC_PATHS.has(path) || path === '/ws') return;

    const payload = verifyToken(readSessionToken(request) ?? '');
    if (!payload) {
      return reply.code(401).send({ success: false, error: 'No autenticado' });
    }
    (request as typeof request & { userId?: string }).userId = payload.sub;
  });

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
  app.register(friendRoutes);
  app.register(arenaRoutes);
  app.register(starterRoutes);
  app.register(inventoryRoutes);
  app.register(shopRoutes);
  app.register(wsRoutes);

  return app;
}
