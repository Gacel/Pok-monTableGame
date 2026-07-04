import { FastifyReply, FastifyRequest } from 'fastify';
import { UserModel } from '../models/UserModel.js';
import { toPublicUser } from './FriendController.js';
import { OwnedPokemonModel } from '../models/OwnedPokemonModel.js';

interface SearchQuery {
  q?: string;
}

/** Capa CONTROLADOR: perfil del usuario autenticado. El id sale del JWT ya
 *  verificado por el hook global (request.userId). */
export const UserController = {
  async me(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as FastifyRequest & { userId?: string }).userId;
    if (!userId) return reply.code(401).send({ success: false, error: 'No autenticado' });

    const user = await UserModel.findById(userId);
    if (!user) return reply.code(404).send({ success: false, error: 'Usuario no encontrado' });

    // Conteo de Pokémon propios: sirve para el gating de "elegir starters" en el primer login.
    const pokemonCount = await OwnedPokemonModel.countByUser(userId);
    return { success: true, user: { ...user, pokemonCount } };
  },

  /** Busca usuarios por nombre para "añadir amigo" (devuelve vista pública). */
  async search(request: FastifyRequest<{ Querystring: SearchQuery }>, reply: FastifyReply) {
    const userId = (request as FastifyRequest & { userId?: string }).userId;
    if (!userId) return reply.code(401).send({ success: false, error: 'No autenticado' });

    const q = (request.query?.q ?? '').trim();
    if (q.length < 2) return { success: true, users: [] };

    const users = await UserModel.searchByUsername(q, userId);
    return { success: true, users: users.map(toPublicUser) };
  },
};
