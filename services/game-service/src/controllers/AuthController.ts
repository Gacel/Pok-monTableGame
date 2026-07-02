import { FastifyReply, FastifyRequest } from 'fastify';
import { UserModel } from '../models/UserModel.js';
import { signToken } from '../auth/jwt.js';

interface LoginBody {
  email?: string;
}
interface RegisterBody {
  username?: string;
  avatarUrl?: string;
}

/** Deriva un id de usuario estable a partir del email. */
function userIdFromEmail(email: string): string {
  return `usr_${Buffer.from(email).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 32)}`;
}

function normalizeEmail(raw: unknown): string {
  return (typeof raw === 'string' ? raw : '').trim().toLowerCase();
}

/**
 * Capa CONTROLADOR de autenticación. Emite JWT firmados (auth/jwt.ts) y
 * persiste usuarios en SQLite (UserModel). Login y registro son distintos:
 *   - signup crea la cuenta (409 si ya existe).
 *   - login solo entra a cuentas existentes (404 si no existe).
 */
export const AuthController = {
  /** Registro: crea una cuenta nueva para el email y devuelve un JWT. */
  async signup(request: FastifyRequest<{ Body: LoginBody }>, reply: FastifyReply) {
    const email = normalizeEmail(request.body?.email);
    if (!email || email.length > 254) {
      return reply.code(400).send({ success: false, error: 'Email inválido' });
    }
    const id = userIdFromEmail(email);
    const existing = await UserModel.findById(id);
    if (existing) {
      return reply
        .code(409)
        .send({ success: false, error: 'Ya existe una cuenta con ese correo. Inicia sesión.' });
    }
    const user = await UserModel.createWithEmail(id, email);
    return { success: true, token: signToken(id), user };
  },

  /** Login: solo cuentas ya registradas. */
  async login(request: FastifyRequest<{ Body: LoginBody }>, reply: FastifyReply) {
    const email = normalizeEmail(request.body?.email);
    if (!email || email.length > 254) {
      return reply.code(400).send({ success: false, error: 'Email inválido' });
    }
    const id = userIdFromEmail(email);
    const user = await UserModel.findById(id);
    if (!user) {
      return reply
        .code(404)
        .send({ success: false, error: 'No existe una cuenta con ese correo. Regístrate.' });
    }
    return { success: true, token: signToken(id), user };
  },

  /**
   * Completa el perfil (nombre + avatar) del usuario AUTENTICADO. El id se toma
   * del JWT verificado (request.userId, inyectado por el hook global de auth).
   */
  async register(request: FastifyRequest<{ Body: RegisterBody }>, reply: FastifyReply) {
    const userId = (request as FastifyRequest & { userId?: string }).userId;
    if (!userId) return reply.code(401).send({ success: false, error: 'No autenticado' });

    const username = (request.body?.username ?? '').trim();
    const avatarUrl = (request.body?.avatarUrl ?? '').trim();

    if (!username || !avatarUrl) {
      return reply.code(400).send({ success: false, error: 'Faltan datos' });
    }
    if (username.length > 16 || !/^[\w\sáéíóúñÁÉÍÓÚÑ-]+$/u.test(username)) {
      return reply.code(400).send({ success: false, error: 'Nombre de usuario inválido' });
    }
    const user = await UserModel.setProfile(userId, username, avatarUrl);
    if (!user) return reply.code(404).send({ success: false, error: 'Usuario no encontrado' });
    return { success: true, user };
  },

  async googleCallback(request: FastifyRequest, reply: FastifyReply) {
    try {
      // @ts-ignore - el plugin decora la instancia; los tipos no siempre lo captan
      const { token } = await request.server.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(request);

      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${token.access_token}` },
      });
      const userInfo = (await userInfoResponse.json()) as { email?: string };

      const email = normalizeEmail(userInfo.email);
      if (!email) {
        return reply.code(400).send({ success: false, error: 'No se pudo obtener el email de Google' });
      }

      const id = userIdFromEmail(email);
      await UserModel.createWithEmail(id, email);

      // Redirige al frontend con un JWT firmado (no el id crudo).
      return reply.redirect(`/?token=${signToken(id)}`);
    } catch (err) {
      request.server.log.error(err);
      return reply.code(500).send({ success: false, error: 'Fallo en la autenticación con Google' });
    }
  },
};
