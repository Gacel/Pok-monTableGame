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
interface CombatBody {
  action?: string;
  moveName?: string;
  targetId?: string;
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

  async combatAction(
    request: FastifyRequest<{ Params: MatchParams; Body: CombatBody }>,
    reply: FastifyReply
  ) {
    const actor = await resolveActor(request, reply);
    if (!actor) return;
    const action = String(request.body?.action ?? '');
    const moveName =
      typeof request.body?.moveName === 'string' ? request.body.moveName.slice(0, 40) : undefined;
    const targetId =
      typeof request.body?.targetId === 'string' ? request.body.targetId.slice(0, 40) : undefined;
    return apply(actor, { type: 'combat_action', action, moveName, targetId }, reply);
  },

  async combatContinue(request: FastifyRequest<{ Params: MatchParams }>, reply: FastifyReply) {
    const actor = await resolveActor(request, reply);
    if (!actor) return;
    return apply(actor, { type: 'combat_continue' }, reply);
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
