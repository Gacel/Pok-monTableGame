import { FastifyReply, FastifyRequest } from 'fastify';
import type { GameMode } from '@transcendence/shared';
import { matchManager } from '../services/MatchManager.js';
import { hub, LOCAL_ROOM } from '../realtime/hub.js';
import { Hex } from '../engine/hex.js';
import { CombatAction } from '../services/GameService.js';

interface MoveBody {
  from?: Hex;
  to?: Hex;
}
interface OptionsQuery {
  q?: string;
  r?: string;
}
interface CombatBody {
  action?: string;
  moveName?: string;
  targetId?: string;
}
interface StartBody {
  player1?: unknown;
  player2?: unknown;
  player3?: unknown;
  player4?: unknown;
  gameMode?: unknown;
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

function asNameArray(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  if (!v.every((x) => typeof x === 'string' && x.length > 0 && x.length <= 32)) return null;
  return v as string[];
}

/**
 * Capa CONTROLADOR: expone el estado autoritativo. La lógica de juego vive en
 * GameService; aquí solo validamos input y difundimos por WSS tras cada cambio.
 */
export const GameController = {
  async getBoard() {
    return matchManager.get().getStateDTO().tiles;
  },

  async getState() {
    return matchManager.get().getStateDTO();
  },

  /** Pool de Pokémon para el draft inicial (≥12). */
  async getRoster() {
    return { roster: await matchManager.getRoster() };
  },

  async getMoveOptions(request: FastifyRequest<{ Querystring: OptionsQuery }>, reply: FastifyReply) {
    const q = Number(request.query.q);
    const r = Number(request.query.r);
    if (!Number.isInteger(q) || !Number.isInteger(r)) {
      return reply.code(400).send({ error: 'Coordenadas inválidas' });
    }
    return matchManager.get().getMoveOptions({ q, r });
  },

  /**
   * Inicia una partida LOCAL con los equipos del draft (3 por jugador,
   * de 2 a 4 jugadores; gameMode 'teams' = 2v2 con exactamente 4).
   */
  async start(request: FastifyRequest<{ Body: StartBody }>, reply: FastifyReply) {
    const teams: Record<string, string[]> = {};
    const bodies = [
      request.body?.player1,
      request.body?.player2,
      request.body?.player3,
      request.body?.player4,
    ];
    for (let i = 0; i < bodies.length; i++) {
      const raw = bodies[i];
      if (raw === undefined) break; // los jugadores deben ser contiguos: 1..N
      const team = asNameArray(raw);
      if (!team || team.length !== 3) {
        return reply
          .code(400)
          .send({ success: false, error: 'Cada jugador debe elegir 3 Pokémon' });
      }
      teams[`player${i + 1}`] = team;
    }
    if (Object.keys(teams).length < 2) {
      return reply.code(400).send({ success: false, error: 'Se necesitan al menos 2 jugadores' });
    }
    const gm = request.body?.gameMode;
    const gameMode = (gm === 'teams' || gm === 'arena' ? gm : 'ffa') as GameMode;
    try {
      const game = await matchManager.startMatch(teams, gameMode);
      hub.broadcast(LOCAL_ROOM, { type: 'state', state: game.getStateDTO() });
      return { success: true, state: game.getStateDTO() };
    } catch (e) {
      return reply.code(400).send({ success: false, error: (e as Error).message });
    }
  },

  async move(request: FastifyRequest<{ Body: MoveBody }>, reply: FastifyReply) {
    const { from, to } = request.body ?? {};
    if (!isHex(from) || !isHex(to)) {
      return reply.code(400).send({ success: false, error: 'Coordenadas from/to inválidas' });
    }
    const game = matchManager.get();
    const actor = game.getStateDTO().currentPlayer;
    const result = game.play(actor, from, to);
    if (!result.ok) {
      return reply.code(400).send({ success: false, error: result.error, state: result.state });
    }
    await matchManager.persist();
    hub.broadcast(LOCAL_ROOM, { type: 'state', state: result.state });
    return { success: true, state: result.state };
  },

  /** Acción dentro del combate interactivo (ATACAR/HABILIDAD/OBJETO/HUIR). */
  async combatAction(request: FastifyRequest<{ Body: CombatBody }>, reply: FastifyReply) {
    const action = String(request.body?.action ?? '').toUpperCase() as CombatAction;
    if (!COMBAT_ACTIONS.includes(action)) {
      return reply.code(400).send({ success: false, error: 'Acción de combate inválida' });
    }
    const moveName =
      typeof request.body?.moveName === 'string' ? request.body.moveName.slice(0, 40) : undefined;
    const targetId =
      typeof request.body?.targetId === 'string' ? request.body.targetId.slice(0, 40) : undefined;
    const result = matchManager.get().combatAction(action, moveName, targetId);
    if (!result.ok) {
      return reply.code(400).send({ success: false, error: result.error, state: result.state });
    }
    await matchManager.persist();
    hub.broadcast(LOCAL_ROOM, { type: 'state', state: result.state });
    return { success: true, state: result.state };
  },

  /** Cierra la fase de resultado del combate y devuelve al tablero. */
  async combatContinue() {
    const result = matchManager.get().continueCombat();
    if (!result.ok) {
      return { success: false, error: result.error, state: result.state };
    }
    await matchManager.persist();
    hub.broadcast(LOCAL_ROOM, { type: 'state', state: result.state });
    return { success: true, state: result.state };
  },

  async reset() {
    const game = await matchManager.reset();
    hub.broadcast(LOCAL_ROOM, { type: 'state', state: game.getStateDTO() });
    return { success: true, state: game.getStateDTO() };
  },

  async endTurn() {
    const game = matchManager.get();
    const result = game.endTurn();
    if (!result.ok) {
      return { success: false, error: result.error, state: result.state };
    }
    await matchManager.persist();
    hub.broadcast(LOCAL_ROOM, { type: 'state', state: result.state });
    return { success: true, state: result.state };
  },

  async abandon() {
    const game = matchManager.get();
    const result = game.abandon();
    if (!result.ok) {
      return { success: false, error: result.error, state: result.state };
    }
    await matchManager.persist();
    hub.broadcast(LOCAL_ROOM, { type: 'state', state: result.state });
    return { success: true, state: result.state };
  },
};
