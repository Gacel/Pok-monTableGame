import { FastifyReply, FastifyRequest } from 'fastify';
import type { PlayerSlot } from '@transcendence/shared';
import { bearerToken, resolveUser } from '../auth/identity.js';
import { matchManager } from '../services/MatchManager.js';
import { RoomService } from '../services/RoomService.js';
import { hub } from '../realtime/hub.js';
import { Hex } from '../engine/hex.js';
import { CombatAction, GameService, PlayResult } from '../services/GameService.js';
import { UserModel } from '../models/UserModel.js';

/** Monedas: 500 por Pokémon vencido; pool de 1000×perdedores repartido entre ganadores. */
const COINS_PER_KO = 500;
const WIN_POOL_PER_LOSER = 1000;

/**
 * Acredita monedas tras una acción (online/arena): 500 al killer por cada KO y,
 * al finalizar, el pool de victoria repartido entre los ganadores.
 */
async function awardCoins(matchId: string, result: PlayResult): Promise<void> {
  const state = result.state;
  const hasDefeats = (state.defeats?.length ?? 0) > 0;
  const finished = state.status === 'finished' && !!state.winner;
  if (!hasDefeats && !finished) return;

  const bySlot = await RoomService.slotUserMap(matchId);
  for (const d of state.defeats ?? []) {
    const uid = bySlot.get(d.killerSlot as PlayerSlot);
    if (uid) await UserModel.addCoins(uid, COINS_PER_KO);
  }
  if (finished && state.winner) {
    const winners = state.winner.split(' & ');
    const losers = Math.max(0, state.players.length - winners.length);
    const perWinner = winners.length > 0 ? Math.floor((WIN_POOL_PER_LOSER * losers) / winners.length) : 0;
    for (const slot of winners) {
      const uid = bySlot.get(slot as PlayerSlot);
      if (uid && perWinner > 0) await UserModel.addCoins(uid, perWinner);
    }
  }
}

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

const COMBAT_ACTIONS: CombatAction[] = ['ATACAR', 'HABILIDAD', 'OBJETO', 'HUIR', 'MOVE', 'TARGET'];

function isHex(h: unknown): h is Hex {
  return (
    typeof h === 'object' &&
    h !== null &&
    Number.isInteger((h as Hex).q) &&
    Number.isInteger((h as Hex).r)
  );
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

/** ¿Controla `slot` al Pokémon que debe actuar en el combate en curso? */
function controlsCombatTurn(game: GameService, slot: PlayerSlot): boolean {
  const combat = game.getStateDTO().combat;
  if (!combat) return false;
  const actorPlayer =
    combat.turnActorId === combat.attackerId ? combat.attackerPlayer : combat.defenderPlayer;
  return actorPlayer === slot;
}

async function commit(matchId: string, result: PlayResult, reply: FastifyReply) {
  if (!result.ok) {
    return reply.code(400).send({ success: false, error: result.error, state: result.state });
  }
  await matchManager.persistMatch(matchId);
  await awardCoins(matchId, result);
  hub.broadcast(matchId, { type: 'state', state: result.state });
  if (result.state.status === 'finished') matchManager.evict(matchId);
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

  async move(
    request: FastifyRequest<{ Params: MatchParams; Body: MoveBody }>,
    reply: FastifyReply
  ) {
    const actor = await resolveActor(request, reply);
    if (!actor) return;
    const { from, to } = request.body ?? {};
    if (!isHex(from) || !isHex(to)) {
      return reply.code(400).send({ success: false, error: 'Coordenadas from/to inválidas' });
    }
    // El motor ya valida turno y propiedad de la pieza contra `slot`.
    return commit(actor.matchId, actor.game.play(actor.slot, from, to), reply);
  },

  async combatAction(
    request: FastifyRequest<{ Params: MatchParams; Body: CombatBody }>,
    reply: FastifyReply
  ) {
    const actor = await resolveActor(request, reply);
    if (!actor) return;
    const action = String(request.body?.action ?? '').toUpperCase() as CombatAction;
    if (!COMBAT_ACTIONS.includes(action)) {
      return reply.code(400).send({ success: false, error: 'Acción de combate inválida' });
    }
    if (!controlsCombatTurn(actor.game, actor.slot)) {
      return reply.code(403).send({ success: false, error: 'No es el turno de tu Pokémon' });
    }
    const moveName =
      typeof request.body?.moveName === 'string' ? request.body.moveName.slice(0, 40) : undefined;
    const targetId =
      typeof request.body?.targetId === 'string' ? request.body.targetId.slice(0, 40) : undefined;
    return commit(actor.matchId, actor.game.combatAction(action, moveName, targetId), reply);
  },

  async combatContinue(request: FastifyRequest<{ Params: MatchParams }>, reply: FastifyReply) {
    const actor = await resolveActor(request, reply);
    if (!actor) return;
    return commit(actor.matchId, actor.game.continueCombat(), reply);
  },

  async endTurn(request: FastifyRequest<{ Params: MatchParams }>, reply: FastifyReply) {
    const actor = await resolveActor(request, reply);
    if (!actor) return;
    // endTurn(slot) rechaza si no es el turno de este jugador.
    return commit(actor.matchId, actor.game.endTurn(actor.slot), reply);
  },

  async abandon(request: FastifyRequest<{ Params: MatchParams }>, reply: FastifyReply) {
    const actor = await resolveActor(request, reply);
    if (!actor) return;
    // Abandona SIEMPRE quien firma la petición, no el jugador de turno.
    return commit(actor.matchId, actor.game.abandon(actor.slot), reply);
  },
};
