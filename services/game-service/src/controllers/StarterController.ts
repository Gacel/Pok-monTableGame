import { FastifyReply, FastifyRequest } from 'fastify';
import { STARTER_POOL, STARTER_PICK } from '../services/MatchManager.js';
import { PokemonService } from '../services/PokemonService.js';
import { OwnedPokemonModel } from '../models/OwnedPokemonModel.js';

interface ChooseBody {
  names?: string[];
}

function userId(request: FastifyRequest): string | null {
  return (request as FastifyRequest & { userId?: string }).userId ?? null;
}

/**
 * Capa CONTROLADOR: selección de starters (primer login). El jugador elige
 * STARTER_PICK (3) de STARTER_POOL (12) Pokémon balanceados.
 */
export const StarterController = {
  /** Devuelve las 12 opciones con sus stats (para la UI de selección). */
  async options(_request: FastifyRequest, reply: FastifyReply) {
    try {
      const options = await Promise.all(
        STARTER_POOL.map(async (name) => {
          const t = await PokemonService.getTemplate(name);
          return { name, type: t.type, hp: t.hp, atk: t.atk, def: t.def, speed: t.speed, size: t.size };
        })
      );
      return { success: true, pick: STARTER_PICK, options };
    } catch {
      return reply.code(502).send({ success: false, error: 'No se pudieron cargar las opciones' });
    }
  },

  /** Concede los 3 starters elegidos. Solo si el usuario aún no tiene Pokémon. */
  async choose(request: FastifyRequest<{ Body: ChooseBody }>, reply: FastifyReply) {
    const uid = userId(request);
    if (!uid) return reply.code(401).send({ success: false, error: 'No autenticado' });

    const names = request.body?.names ?? [];
    const valid =
      Array.isArray(names) &&
      names.length === STARTER_PICK &&
      new Set(names).size === names.length &&
      names.every((n) => STARTER_POOL.includes(n));
    if (!valid) {
      return reply
        .code(400)
        .send({ success: false, error: `Elige ${STARTER_PICK} Pokémon distintos de la lista` });
    }
    if ((await OwnedPokemonModel.countByUser(uid)) > 0) {
      return reply.code(409).send({ success: false, error: 'Ya has elegido tus starters' });
    }
    await OwnedPokemonModel.grantMany(uid, names, 'starter');
    return { success: true };
  },
};
