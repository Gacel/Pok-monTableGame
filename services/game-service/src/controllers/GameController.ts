import { FastifyReply, FastifyRequest } from 'fastify';
import { matchManager } from '../services/MatchManager.js';
import { hub } from '../realtime/hub.js';
import { Hex } from '../engine/hex.js';

interface MoveBody {
  from?: Hex;
  to?: Hex;
}
interface OptionsQuery {
  q?: string;
  r?: string;
}

function isHex(h: unknown): h is Hex {
  return (
    typeof h === 'object' &&
    h !== null &&
    Number.isInteger((h as Hex).q) &&
    Number.isInteger((h as Hex).r)
  );
}

/**
 * Capa CONTROLADOR: expone el estado autoritativo de la partida. La lógica de
 * juego vive en GameService; aquí solo validamos input y serializamos la respuesta.
 */
export const GameController = {
  /** Compatibilidad: devuelve solo el array de losetas. */
  async getBoard() {
    return matchManager.get().getStateDTO().tiles;
  },

  /** Estado completo (turno, jugador, recursos, log, ganador). */
  async getState() {
    return matchManager.get().getStateDTO();
  },

  /** Movimientos y ataques legales para la pieza en (q,r). */
  async getMoveOptions(request: FastifyRequest<{ Querystring: OptionsQuery }>, reply: FastifyReply) {
    const q = Number(request.query.q);
    const r = Number(request.query.r);
    if (!Number.isInteger(q) || !Number.isInteger(r)) {
      return reply.code(400).send({ error: 'Coordenadas inválidas' });
    }
    return matchManager.get().getMoveOptions({ q, r });
  },

  /** Aplica una intención de movimiento/ataque del jugador de turno. */
  async move(request: FastifyRequest<{ Body: MoveBody }>, reply: FastifyReply) {
    const { from, to } = request.body ?? {};
    if (!isHex(from) || !isHex(to)) {
      return reply.code(400).send({ success: false, error: 'Coordenadas from/to inválidas' });
    }
    const game = matchManager.get();
    // El actor es SIEMPRE el jugador de turno (hot-seat) → autoridad del servidor.
    const actor = game.getStateDTO().currentPlayer;
    const result = game.play(actor, from, to);
    if (!result.ok) {
      return reply.code(400).send({ success: false, error: result.error, state: result.state });
    }
    await matchManager.persist();
    // Difunde a los clientes WSS conectados para mantener el tablero sincronizado.
    hub.broadcast({ type: 'state', state: result.state, combat: result.combat ?? null });
    return { success: true, state: result.state, combat: result.combat ?? null };
  },

  /** Reinicia la partida por defecto. */
  async reset() {
    const game = await matchManager.reset();
    hub.broadcast({ type: 'state', state: game.getStateDTO() });
    return { success: true, state: game.getStateDTO() };
  },
};
