import { FastifyReply, FastifyRequest } from 'fastify';
import { UserModel } from '../models/UserModel.js';

interface LoginBody {
  email?: string;
}
interface RegisterBody {
  token?: string;
  username?: string;
  avatarUrl?: string;
}

/** Deriva un id de usuario estable a partir del email (login mock de transición). */
function mockUserId(email: string): string {
  return `usr_${Buffer.from(email).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 12)}`;
}

/**
 * Capa CONTROLADOR (transición): auth mock hasta que exista auth-service real.
 * Valida input y delega la persistencia en UserModel.
 */
export const AuthController = {
  async login(request: FastifyRequest<{ Body: LoginBody }>, reply: FastifyReply) {
    const email = (request.body?.email ?? '').trim().toLowerCase();
    if (!email || email.length > 254) {
      return reply.code(400).send({ success: false, error: 'Email inválido' });
    }
    const id = mockUserId(email);
    const user = await UserModel.findOrCreate(id);
    return { success: true, token: id, user };
  },

  async register(request: FastifyRequest<{ Body: RegisterBody }>, reply: FastifyReply) {
    const token = (request.body?.token ?? '').trim();
    const username = (request.body?.username ?? '').trim();
    const avatarUrl = (request.body?.avatarUrl ?? '').trim();

    if (!token || !username || !avatarUrl) {
      return reply.code(400).send({ success: false, error: 'Faltan datos' });
    }
    if (username.length > 16 || !/^[\w\sáéíóúñÁÉÍÓÚÑ-]+$/u.test(username)) {
      return reply.code(400).send({ success: false, error: 'Nombre de usuario inválido' });
    }
    const user = await UserModel.setProfile(token, username, avatarUrl);
    if (!user) return reply.code(404).send({ success: false, error: 'Usuario no encontrado' });
    return { success: true, user };
  },
};
