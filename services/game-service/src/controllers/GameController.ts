import { FastifyReply, FastifyRequest } from 'fastify';
import { matchManager } from '../services/MatchManager.js';
import { hub } from '../realtime/hub.js';
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
}
interface StartBody {
  player1?: unknown;
  player2?: unknown;
}

const COMBAT_ACTIONS: CombatAction[] = ['ATACAR', 'HABILIDAD', 'OBJETO', 'HUIR'];

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

  /** Inicia una partida con los equipos elegidos en el draft (3 por jugador). */
  async start(request: FastifyRequest<{ Body: StartBody }>, reply: FastifyReply) {
    const p1 = asNameArray(request.body?.player1);
    const p2 = asNameArray(request.body?.player2);
    if (!p1 || !p2 || p1.length !== 3 || p2.length !== 3) {
      return reply.code(400).send({ success: false, error: 'Cada jugador debe elegir 3 Pokémon' });
    }
    try {
      const game = await matchManager.startMatch({ player1: p1, player2: p2 });
      hub.broadcast({ type: 'state', state: game.getStateDTO() });
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
    hub.broadcast({ type: 'state', state: result.state });
    return { success: true, state: result.state };
  },

  /** Acción dentro del combate interactivo (ATACAR/HABILIDAD/OBJETO/HUIR). */
  async combatAction(request: FastifyRequest<{ Body: CombatBody }>, reply: FastifyReply) {
    const action = String(request.body?.action ?? '').toUpperCase() as CombatAction;
    if (!COMBAT_ACTIONS.includes(action)) {
      return reply.code(400).send({ success: false, error: 'Acción de combate inválida' });
    }
    const result = matchManager.get().combatAction(action);
    if (!result.ok) {
      return reply.code(400).send({ success: false, error: result.error, state: result.state });
    }
    await matchManager.persist();
    hub.broadcast({ type: 'state', state: result.state });
    return { success: true, state: result.state };
  },

  /** Cierra la fase de resultado del combate y devuelve al tablero. */
  async combatContinue() {
    const result = matchManager.get().continueCombat();
    if (!result.ok) {
      return { success: false, error: result.error, state: result.state };
    }
    await matchManager.persist();
    hub.broadcast({ type: 'state', state: result.state });
    return { success: true, state: result.state };
  },

  async reset() {
    const game = await matchManager.reset();
    hub.broadcast({ type: 'state', state: game.getStateDTO() });
    return { success: true, state: game.getStateDTO() };
  },
};
