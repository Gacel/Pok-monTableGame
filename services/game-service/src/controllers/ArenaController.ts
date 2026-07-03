import { FastifyReply, FastifyRequest } from 'fastify';
import { RoomService, RoomError } from '../services/RoomService.js';
import { UserModel } from '../models/UserModel.js';

interface JoinBody {
  team?: string[];
}

function userId(request: FastifyRequest): string | null {
  return (request as FastifyRequest & { userId?: string }).userId ?? null;
}

/**
 * Capa CONTROLADOR: ARENA (mundo vivo persistente). Sin anfitrión ni sala de
 * espera: se entra directamente (aunque estés solo) eligiendo equipo.
 */
export const ArenaController = {
  /** Estado de la ARENA + tu slot (para reingreso o UI). */
  async get(request: FastifyRequest, reply: FastifyReply) {
    if (!userId(request)) return reply.code(401).send({ success: false, error: 'No autenticado' });
    const room = await RoomService.getArena(userId(request));
    return { success: true, room };
  },

  /** Entrar en la ARENA con un equipo (3 Pokémon). Coloca en spawn aleatorio. */
  async join(request: FastifyRequest<{ Body: JoinBody }>, reply: FastifyReply) {
    const uid = userId(request);
    if (!uid) return reply.code(401).send({ success: false, error: 'No autenticado' });
    const user = await UserModel.findById(uid);
    const username = user?.username ?? 'Entrenador';
    try {
      const room = await RoomService.joinArena(uid, username, request.body?.team ?? []);
      return { success: true, room };
    } catch (err) {
      if (err instanceof RoomError) {
        return reply.code(err.code).send({ success: false, error: err.message });
      }
      request.server.log.error(err);
      return reply.code(500).send({ success: false, error: 'No se pudo entrar en la ARENA' });
    }
  },

  /** Salir de la ARENA (retira tus piezas). */
  async leave(request: FastifyRequest, reply: FastifyReply) {
    const uid = userId(request);
    if (!uid) return reply.code(401).send({ success: false, error: 'No autenticado' });
    await RoomService.leaveArena(uid);
    return { success: true };
  },
};
