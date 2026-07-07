import { FastifyReply, FastifyRequest } from 'fastify';
import type { PlayerSlot } from '@transcendence/shared';
import { bearerToken, resolveUser } from '../auth/identity.js';
import { matchManager } from '../services/MatchManager.js';
import { RoomService } from '../services/RoomService.js';
import { Hex } from '../engine/hex.js';
import { GameService, PlayResult } from '../services/GameService.js';
import { GameActionService, GameAction } from '../services/GameActionService.js';
import { isHex } from '../utils/hex.js';

interface MatchParams {
  matchId: string;
}
interface MoveBody {
  from?: Hex;
  to?: Hex;
}
interface DeployBody {
  pokemonId?: string;
  hex?: Hex;
}
interface CastBody {
  from?: Hex;
  target?: Hex;
  moveIndex?: number;
}

interface OptionsQuery {
  q?: string;
  r?: string;
}

interface OnlineActor {
  matchId: string;
  game: GameService;
  slot: PlayerSlot;
}

/**
 * Identidad → slot en la partida. A diferencia del modo local (hot-seat),
 * online cada acción se ejecuta como el jugador DUEÑO del token, nunca como
 * el `currentPlayer` que diga el cliente.
 */
async function resolveActor(
  request: FastifyRequest<{ Params: MatchParams }>,
  reply: FastifyReply
): Promise<OnlineActor | null> {
  const matchId = request.params.matchId;
  const game = await matchManager.getMatch(matchId);
  if (!game) {
    await reply.code(404).send({ success: false, error: 'La partida no existe' });
    return null;
  }
  const user = await resolveUser(bearerToken(request));
  if (!user) {
    await reply.code(401).send({ success: false, error: 'Inicia sesión para jugar online' });
    return null;
  }
  const slot = await RoomService.slotFor(matchId, user.id);
  if (!slot) {
    await reply.code(403).send({ success: false, error: 'No participas en esta partida' });
    return null;
  }
  return { matchId, game, slot };
}

/** Ejecuta una acción online a través del pipeline único y responde HTTP. */
async function apply(actor: OnlineActor, action: GameAction, reply: FastifyReply) {
  const result: PlayResult = await GameActionService.apply(
    { game: actor.game, actor: actor.slot, isLocal: false, room: actor.matchId, matchId: actor.matchId },
    action
  );
  if (!result.ok) {
    return reply.code(400).send({ success: false, error: result.error, state: result.state });
  }
  return { success: true, state: result.state };
}

/** Capa CONTROLADOR: acciones de partida ONLINE, validadas por identidad. */
export const OnlineGameController = {
  async getState(request: FastifyRequest<{ Params: MatchParams }>, reply: FastifyReply) {
    const game = await matchManager.getMatch(request.params.matchId);
    if (!game) return reply.code(404).send({ success: false, error: 'La partida no existe' });
    return game.getStateDTO();
  },

  async getMoveOptions(
    request: FastifyRequest<{ Params: MatchParams; Querystring: OptionsQuery }>,
    reply: FastifyReply
  ) {
    const game = await matchManager.getMatch(request.params.matchId);
    if (!game) return reply.code(404).send({ success: false, error: 'La partida no existe' });
    const q = Number(request.query.q);
    const r = Number(request.query.r);
    if (!Number.isInteger(q) || !Number.isInteger(r)) {
      return reply.code(400).send({ error: 'Coordenadas inválidas' });
    }
    return game.getMoveOptions({ q, r });
  },

  async move(request: FastifyRequest<{ Params: MatchParams; Body: MoveBody }>, reply: FastifyReply) {
    const actor = await resolveActor(request, reply);
    if (!actor) return;
    const { from, to } = request.body ?? {};
    if (!isHex(from) || !isHex(to)) {
      return reply.code(400).send({ success: false, error: 'Coordenadas from/to inválidas' });
    }
    return apply(actor, { type: 'move', from, to }, reply);
  },

  async deploy(request: FastifyRequest<{ Params: MatchParams; Body: DeployBody }>, reply: FastifyReply) {
    const actor = await resolveActor(request, reply);
    if (!actor) return;
    const { pokemonId, hex } = request.body ?? {};
    if (typeof pokemonId !== 'string' || !isHex(hex)) {
      return reply.code(400).send({ success: false, error: 'Parámetros inválidos' });
    }
    return apply(actor, { type: 'deploy', pokemonId, hex }, reply);
  },

  async cast(request: FastifyRequest<{ Params: MatchParams; Body: CastBody }>, reply: FastifyReply) {
    const actor = await resolveActor(request, reply);
    if (!actor) return;
    const { from, target, moveIndex } = request.body ?? {};
    if (!isHex(from) || !isHex(target) || typeof moveIndex !== 'number') {
      return reply.code(400).send({ success: false, error: 'Parámetros inválidos' });
    }
    return apply(actor, { type: 'cast', from, target, moveIndex }, reply);
  },



  async endTurn(request: FastifyRequest<{ Params: MatchParams }>, reply: FastifyReply) {
    const actor = await resolveActor(request, reply);
    if (!actor) return;
    return apply(actor, { type: 'end_turn' }, reply);
  },

  async abandon(request: FastifyRequest<{ Params: MatchParams }>, reply: FastifyReply) {
    const actor = await resolveActor(request, reply);
    if (!actor) return;
    return apply(actor, { type: 'abandon' }, reply);
  },
};
