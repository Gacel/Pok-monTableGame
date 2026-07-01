import { FastifyReply, FastifyRequest } from 'fastify';
import type { GameMode } from '@transcendence/shared';
import { bearerToken, resolveUser } from '../auth/identity.js';
import { RoomError, RoomService } from '../services/RoomService.js';

interface CreateBody {
  name?: unknown;
  capacity?: unknown;
  gameMode?: unknown;
}
interface TeamBody {
  team?: unknown;
}
interface RoomParams {
  id: string;
}

function sendRoomError(reply: FastifyReply, e: unknown) {
  if (e instanceof RoomError) {
    return reply.code(e.code).send({ success: false, error: e.message });
  }
  return reply.code(500).send({ success: false, error: 'Error interno' });
}

/** Usuario autenticado o 401 (el lobby online exige identidad). */
async function requireUser(request: FastifyRequest, reply: FastifyReply) {
  const user = await resolveUser(bearerToken(request));
  if (!user) {
    await reply.code(401).send({ success: false, error: 'Inicia sesión para jugar online' });
    return null;
  }
  return user;
}

/**
 * Capa CONTROLADOR: lobby multijugador (crear partida como anfitrión,
 * buscar partida, unirse, enviar equipo del draft, cancelar).
 */
export const LobbyController = {
  async create(request: FastifyRequest<{ Body: CreateBody }>, reply: FastifyReply) {
    const user = await requireUser(request, reply);
    if (!user) return;
    const name = String(request.body?.name ?? '');
    const capacity = Number(request.body?.capacity ?? 2);
    const gameMode = (request.body?.gameMode === 'teams' ? 'teams' : 'ffa') as GameMode;
    try {
      const room = await RoomService.create(
        user.id,
        user.username ?? 'Entrenador',
        name,
        capacity,
        gameMode
      );
      return { success: true, room };
    } catch (e) {
      return sendRoomError(reply, e);
    }
  },

  async list() {
    return { matches: await RoomService.list() };
  },

  async get(request: FastifyRequest<{ Params: RoomParams }>, reply: FastifyReply) {
    const user = await resolveUser(bearerToken(request));
    try {
      const room = await RoomService.get(request.params.id, user?.id ?? null);
      return { success: true, room };
    } catch (e) {
      return sendRoomError(reply, e);
    }
  },

  async join(request: FastifyRequest<{ Params: RoomParams }>, reply: FastifyReply) {
    const user = await requireUser(request, reply);
    if (!user) return;
    try {
      const room = await RoomService.join(request.params.id, user.id, user.username ?? 'Entrenador');
      return { success: true, room };
    } catch (e) {
      return sendRoomError(reply, e);
    }
  },

  async submitTeam(
    request: FastifyRequest<{ Params: RoomParams; Body: TeamBody }>,
    reply: FastifyReply
  ) {
    const user = await requireUser(request, reply);
    if (!user) return;
    const team = Array.isArray(request.body?.team) ? request.body.team.map(String) : [];
    try {
      const room = await RoomService.submitTeam(request.params.id, user.id, team);
      return { success: true, room };
    } catch (e) {
      return sendRoomError(reply, e);
    }
  },

  async cancel(request: FastifyRequest<{ Params: RoomParams }>, reply: FastifyReply) {
    const user = await requireUser(request, reply);
    if (!user) return;
    try {
      await RoomService.cancel(request.params.id, user.id);
      return { success: true };
    } catch (e) {
      return sendRoomError(reply, e);
    }
  },
};
