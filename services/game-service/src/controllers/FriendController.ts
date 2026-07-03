import { FastifyReply, FastifyRequest } from 'fastify';
import type { PublicUser } from '@transcendence/shared';
import { FriendModel } from '../models/FriendModel.js';
import { UserModel, UserRecord } from '../models/UserModel.js';

interface AddBody {
  userId?: string;
}

/** Proyección pública de un usuario: nunca expone email ni datos sensibles. */
export function toPublicUser(u: UserRecord): PublicUser {
  return { id: u.id, username: u.username, avatarUrl: u.avatarUrl, level: u.level };
}

function requireUserId(request: FastifyRequest): string | null {
  return (request as FastifyRequest & { userId?: string }).userId ?? null;
}

/** Capa CONTROLADOR: COMUNIDAD → amigos. El id del actor sale del JWT. */
export const FriendController = {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const userId = requireUserId(request);
    if (!userId) return reply.code(401).send({ success: false, error: 'No autenticado' });
    const friends = await FriendModel.list(userId);
    return { success: true, friends: friends.map(toPublicUser) };
  },

  async recommended(request: FastifyRequest, reply: FastifyReply) {
    const userId = requireUserId(request);
    if (!userId) return reply.code(401).send({ success: false, error: 'No autenticado' });
    const users = await FriendModel.recommended(userId);
    return { success: true, users: users.map(toPublicUser) };
  },

  async add(request: FastifyRequest<{ Body: AddBody }>, reply: FastifyReply) {
    const userId = requireUserId(request);
    if (!userId) return reply.code(401).send({ success: false, error: 'No autenticado' });

    const friendId = (request.body?.userId ?? '').trim();
    if (!friendId) return reply.code(400).send({ success: false, error: 'Falta el usuario' });
    if (friendId === userId) {
      return reply.code(400).send({ success: false, error: 'No puedes agregarte a ti mismo' });
    }
    const target = await UserModel.findById(friendId);
    if (!target) return reply.code(404).send({ success: false, error: 'Usuario no encontrado' });

    await FriendModel.add(userId, friendId);
    return { success: true, friend: toPublicUser(target) };
  },
};
