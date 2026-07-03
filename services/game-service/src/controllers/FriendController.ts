import { FastifyReply, FastifyRequest } from 'fastify';
import type { PublicUser } from '@transcendence/shared';
import { FriendModel } from '../models/FriendModel.js';
import { UserModel, UserRecord } from '../models/UserModel.js';
import { hub } from '../realtime/hub.js';

interface RequestBody {
  userId?: string;
}
interface FromParams {
  fromId: string;
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
    // Marca presencia (sockets abiertos) para "amigos conectados".
    const withPresence = friends.map((u) => ({ ...toPublicUser(u), online: hub.isOnline(u.id) }));
    return { success: true, friends: withPresence };
  },

  async recommended(request: FastifyRequest, reply: FastifyReply) {
    const userId = requireUserId(request);
    if (!userId) return reply.code(401).send({ success: false, error: 'No autenticado' });
    const users = await FriendModel.recommended(userId);
    return { success: true, users: users.map(toPublicUser) };
  },

  /** Envía una solicitud de amistad (debe confirmarla el receptor). */
  async request(request: FastifyRequest<{ Body: RequestBody }>, reply: FastifyReply) {
    const userId = requireUserId(request);
    if (!userId) return reply.code(401).send({ success: false, error: 'No autenticado' });

    const targetId = (request.body?.userId ?? '').trim();
    if (!targetId) return reply.code(400).send({ success: false, error: 'Falta el usuario' });
    if (targetId === userId) {
      return reply.code(400).send({ success: false, error: 'No puedes agregarte a ti mismo' });
    }
    const target = await UserModel.findById(targetId);
    if (!target) return reply.code(404).send({ success: false, error: 'Usuario no encontrado' });

    if (await FriendModel.areFriends(userId, targetId)) {
      return reply.code(409).send({ success: false, error: 'Ya sois amigos' });
    }
    // Si el otro ya me había solicitado, la petición se acepta automáticamente.
    if (await FriendModel.hasRequest(targetId, userId)) {
      await FriendModel.accept(targetId, userId);
      return { success: true, status: 'accepted', friend: toPublicUser(target) };
    }
    if (await FriendModel.hasRequest(userId, targetId)) {
      return reply.code(409).send({ success: false, error: 'Solicitud ya enviada' });
    }
    await FriendModel.sendRequest(userId, targetId);
    return { success: true, status: 'requested' };
  },

  /** Solicitudes de amistad ENTRANTES (pendientes de mi confirmación). */
  async incoming(request: FastifyRequest, reply: FastifyReply) {
    const userId = requireUserId(request);
    if (!userId) return reply.code(401).send({ success: false, error: 'No autenticado' });
    const users = await FriendModel.listIncoming(userId);
    return { success: true, requests: users.map(toPublicUser) };
  },

  async accept(request: FastifyRequest<{ Params: FromParams }>, reply: FastifyReply) {
    const userId = requireUserId(request);
    if (!userId) return reply.code(401).send({ success: false, error: 'No autenticado' });
    const fromId = request.params.fromId;
    if (!(await FriendModel.hasRequest(fromId, userId))) {
      return reply.code(404).send({ success: false, error: 'No hay solicitud de ese usuario' });
    }
    await FriendModel.accept(fromId, userId);
    const friend = await UserModel.findById(fromId);
    return { success: true, friend: friend ? toPublicUser(friend) : null };
  },

  async reject(request: FastifyRequest<{ Params: FromParams }>, reply: FastifyReply) {
    const userId = requireUserId(request);
    if (!userId) return reply.code(401).send({ success: false, error: 'No autenticado' });
    await FriendModel.removeRequest(request.params.fromId, userId);
    return { success: true };
  },
};
