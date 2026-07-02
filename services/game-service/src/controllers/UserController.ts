import { FastifyReply, FastifyRequest } from 'fastify';
import { UserModel } from '../models/UserModel.js';

/** Capa CONTROLADOR: perfil del usuario autenticado. El id sale del JWT ya
 *  verificado por el hook global (request.userId). */
export const UserController = {
  async me(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as FastifyRequest & { userId?: string }).userId;
    if (!userId) return reply.code(401).send({ success: false, error: 'No autenticado' });

    const user = await UserModel.findById(userId);
    if (!user) return reply.code(404).send({ success: false, error: 'Usuario no encontrado' });

    return { success: true, user };
  },
};
