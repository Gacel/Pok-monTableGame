import { FastifyReply, FastifyRequest } from 'fastify';
import { UserModel } from '../models/UserModel.js';

/** Capa CONTROLADOR: perfil del usuario autenticado (token mock en Bearer). */
export const UserController = {
  async me(request: FastifyRequest, reply: FastifyReply) {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ success: false, error: 'Sin token' });

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const user = await UserModel.findById(token);
    if (!user) return reply.code(404).send({ success: false, error: 'Usuario no encontrado' });

    return { success: true, user };
  },
};
