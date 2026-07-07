import { FastifyReply, FastifyRequest } from 'fastify';
import type { GameMode, MatchStateDTO } from '@transcendence/shared';
import { BALL_SPRITE } from '@transcendence/shared';
import { matchManager } from '../services/MatchManager.js';
import { PokemonService } from '../services/PokemonService.js';
import { MoveModel } from '../models/MoveModel.js';
import { UserModel } from '../models/UserModel.js';
import { ItemModel } from '../models/ItemModel.js';
import { hub, LOCAL_ROOM } from '../realtime/hub.js';
import { Hex } from '../engine/hex.js';
import { GameActionService, GameAction } from '../services/GameActionService.js';
import { isHex } from '../utils/hex.js';

/** Slot del usuario logueado en partidas LOCAL (hot-seat / vs IA): siempre P1. */
const LOCAL_USER_SLOT = 'player1';

function reqUserId(request: FastifyRequest): string | null {
  return (request as FastifyRequest & { userId?: string }).userId ?? null;
}

/**
 * Recompensa LOCAL (hot-seat / vs IA): el online/arena la da EconomyService, pero
 * el modo local no pasa por ahí. Si el usuario logueado (P1) gana, se le acreditan
 * las monedas (500×KOs + pool de victoria) y las bolas conseguidas en el cofre.
 */
async function awardLocal(state: MatchStateDTO, userId: string): Promise<void> {
  if (state.status !== 'finished' || !state.winner) return;
  const winners = state.winner.split(' & ');
  if (!winners.includes(LOCAL_USER_SLOT)) return;

  const kos = state.kos?.[LOCAL_USER_SLOT] ?? 0;
  const losers = Math.max(0, state.players.length - winners.length);
  const winShare = winners.length > 0 ? Math.floor((1000 * losers) / winners.length) : 0;
  const coins = 500 * kos + winShare;
  if (coins > 0) await UserModel.addCoins(userId, coins);

  const reward = state.rewards?.find((r) => r.slot === LOCAL_USER_SLOT);
  for (const ball of reward?.balls ?? []) await ItemModel.add(userId, 'pokeball', BALL_SPRITE[ball], 1);
}

interface MoveBody {
  from?: Hex;
  to?: Hex;
}
interface OptionsQuery {
  q?: string;
  r?: string;
}
interface PokedexParams {
  name?: string;
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

/** Ejecuta una acción LOCAL (hot-seat) por el pipeline único. El actor es el jugador de turno. */
async function applyLocal(action: GameAction, userId?: string | null) {
  const game = matchManager.get();
  const actor = game.getStateDTO().currentPlayer;
  const result = await GameActionService.apply(
    { game, actor, isLocal: true, room: LOCAL_ROOM },
    action
  );
  // Recompensa al usuario logueado si acaba de ganar (local no pasa por EconomyService).
  if (result.ok && userId) await awardLocal(result.state, userId);
  return result.ok
    ? { success: true, state: result.state }
    : { success: false, error: result.error, state: result.state };
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

  /**
   * Ficha (Pokédex) de un Pokémon por nombre: stats, patrón y ataques curados.
   * TODO cache-first: `getTemplate` (tabla `pokemons`) y `getCuratedMoves`
   * (tablas `moves`/`pokemon_moves`) solo tocan PokeAPI la PRIMERA vez y luego
   * sirven desde SQLite. Las fortalezas/debilidades por tipo las deriva el cliente
   * de `typeAdvantage` (@transcendence/shared), sin datos extra.
   */
  async getPokedex(request: FastifyRequest<{ Params: PokedexParams }>, reply: FastifyReply) {
    const name = String(request.params.name ?? '').toLowerCase().slice(0, 32);
    if (!/^[a-z0-9-]+$/.test(name)) {
      return reply.code(400).send({ success: false, error: 'Nombre inválido' });
    }
    const tpl = await PokemonService.getTemplate(name);
    const curated = await PokemonService.getCuratedMoves(name, tpl.type);
    // Enriquece cada ataque con su descripción corta YA cacheada en la tabla
    // `moves` (findMove es una lectura de SQLite: NO genera llamadas a PokeAPI).
    const moves = await Promise.all(
      curated.map(async (m) => {
        const row = await MoveModel.findMove(m.name);
        return { ...m, shortEffect: row?.shortEffect ?? null };
      })
    );
    return {
      success: true,
      pokemon: {
        name: tpl.name,
        type: tpl.type,
        movementPattern: tpl.movementPattern,
        hp: tpl.hp,
        maxHp: tpl.maxHp,
        atk: tpl.atk,
        def: tpl.def,
        moves,
      },
    };
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
    const gameMode = (gm === 'teams' || gm === 'arena' || gm === 'br' ? gm : 'ffa') as GameMode;
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
    return applyLocal({ type: 'move', from, to }, reqUserId(request));
  },

  /** Acción dentro del combate interactivo (ATACAR/HABILIDAD/OBJETO/HUIR). */
  async combatAction(request: FastifyRequest<{ Body: CombatBody }>) {
    const action = String(request.body?.action ?? '');
    const moveName =
      typeof request.body?.moveName === 'string' ? request.body.moveName.slice(0, 40) : undefined;
    const targetId =
      typeof request.body?.targetId === 'string' ? request.body.targetId.slice(0, 40) : undefined;
    return applyLocal({ type: 'combat_action', action, moveName, targetId }, reqUserId(request));
  },

  /** Cierra la fase de resultado del combate y devuelve al tablero. */
  async combatContinue(request: FastifyRequest) {
    return applyLocal({ type: 'combat_continue' }, reqUserId(request));
  },

  async reset() {
    const game = await matchManager.reset();
    hub.broadcast(LOCAL_ROOM, { type: 'state', state: game.getStateDTO() });
    return { success: true, state: game.getStateDTO() };
  },

  async endTurn(request: FastifyRequest) {
    return applyLocal({ type: 'end_turn' }, reqUserId(request));
  },

  async abandon(request: FastifyRequest) {
    return applyLocal({ type: 'abandon' }, reqUserId(request));
  },
};
