import { FastifyInstance } from 'fastify';
import type { SocketStream } from '@fastify/websocket';
import type { WebSocket } from 'ws';
import type { PlayerSlot } from '@transcendence/shared';
import { matchManager } from '../services/MatchManager.js';
import { RoomService } from '../services/RoomService.js';
import { resolveUser } from '../auth/identity.js';
import { hub, LOCAL_ROOM } from '../realtime/hub.js';
import { GameService } from '../services/GameService.js';
import { Hex } from '../engine/hex.js';

interface WsMessage {
  type: 'move' | 'chat' | 'combat_action' | 'combat_continue' | 'end_turn' | 'abandon';
  from?: Hex;
  to?: Hex;
  text?: string;
  action?: string;
  moveName?: string;
}

interface WsQuery {
  matchId?: string;
  token?: string;
}

const COMBAT_ACTIONS = ['ATACAR', 'HABILIDAD', 'OBJETO', 'HUIR'] as const;

function isHex(h: unknown): h is Hex {
  return (
    typeof h === 'object' &&
    h !== null &&
    Number.isInteger((h as Hex).q) &&
    Number.isInteger((h as Hex).r)
  );
}

/** ¿Controla `slot` al Pokémon que debe actuar en el combate en curso? */
function controlsCombatTurn(game: GameService, slot: PlayerSlot): boolean {
  const combat = game.getStateDTO().combat;
  if (!combat) return false;
  const actorPlayer =
    combat.turnActorId === combat.attackerId ? combat.attackerPlayer : combat.defenderPlayer;
  return actorPlayer === slot;
}

/**
 * Sincronización de tablero + chat por WSS, agrupada por sala.
 *   - Sin `matchId` → sala local hot-seat (comportamiento clásico).
 *   - Con `matchId` (+ `token`) → sala online: el socket queda atado a la
 *     identidad y SOLO puede actuar como su propio slot (autoridad servidor).
 */
export async function wsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/ws', { websocket: true }, async (connection: SocketStream, request) => {
    const socket = connection.socket as WebSocket;
    const query = request.query as WsQuery;
    const matchId = (query.matchId ?? '').trim();

    // Exigir JWT válido para abrir el socket (token por query string).
    const user = await resolveUser(query.token);
    if (!user) {
      socket.close(4401, 'No autenticado');
      return;
    }

    if (matchId.startsWith('dm:')) {
      // ---- Chat directo (DM) entre dos amigos: sala 'dm:<idA>:<idB>' ----
      // Los ids van ordenados, así ambos extremos comparten la misma sala.
      const ids = matchId.slice(3).split(':');
      if (ids.length !== 2 || !ids.includes(user.id)) {
        socket.close(4403, 'Canal no autorizado');
        return;
      }
      hub.join(matchId, socket, { userId: user.id, username: user.username, slot: null });
      // El chat se difunde a la sala en el handler de 'chat' (abajo).
    } else if (!matchId) {
      // ---- Sala LOCAL (hot-seat en un solo navegador) -----------------
      // El actor sigue siendo currentPlayer (turno compartido), pero el socket
      // exige un usuario autenticado.
      hub.join(LOCAL_ROOM, socket, { userId: user.id, username: user.username, slot: null });
      hub.send(socket, { type: 'state', state: matchManager.get().getStateDTO() });
    } else {
      // ---- Sala ONLINE -------------------------------------------------
      let room;
      try {
        room = await RoomService.get(matchId, user.id);
        hub.join(matchId, socket, {
          userId: user.id,
          username: user.username ?? null,
          slot: room.youAre,
        });
      } catch {
        socket.close(4404, 'Sala no encontrada');
        return;
      }
      hub.send(socket, { type: 'room', room });
      const game = await matchManager.getMatch(matchId);
      if (game) hub.send(socket, { type: 'state', state: game.getStateDTO() });
    }

    socket.on('message', async (raw: Buffer) => {
      let msg: WsMessage;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        hub.send(socket, { type: 'error', error: 'JSON inválido' });
        return;
      }

      const ctx = hub.ctxOf(socket);
      if (!ctx) return;
      const isLocal = ctx.matchId === LOCAL_ROOM;

      // Chat: siempre permitido, solo dentro de la sala.
      if (msg.type === 'chat') {
        const text = (msg.text ?? '').toString().slice(0, 200);
        if (!text.trim()) return;
        const label = ctx.username ? `${ctx.username}: ${text}` : text;
        hub.broadcast(ctx.matchId, { type: 'chat', text: label });
        return;
      }

      // Acciones de juego: resolver la partida y el actor según la sala.
      let game: GameService | null;
      let actor: string | null;
      if (isLocal) {
        game = matchManager.get();
        actor = game.getStateDTO().currentPlayer; // hot-seat: turno compartido
      } else {
        game = await matchManager.getMatch(ctx.matchId);
        actor = ctx.slot; // online: SOLO tu propio slot
        if (!game) {
          hub.send(socket, { type: 'error', error: 'La partida aún no ha empezado' });
          return;
        }
        if (!actor) {
          hub.send(socket, { type: 'error', error: 'No participas en esta partida' });
          return;
        }
      }

      const persist = async () => {
        if (isLocal) await matchManager.persist();
        else await matchManager.persistMatch(ctx.matchId);
      };

      if (msg.type === 'move') {
        if (!isHex(msg.from) || !isHex(msg.to)) {
          hub.send(socket, { type: 'error', error: 'Coordenadas inválidas' });
          return;
        }
        const result = game.play(actor!, msg.from, msg.to);
        if (!result.ok) {
          hub.send(socket, { type: 'error', error: result.error });
          return;
        }
        await persist();
        hub.broadcast(ctx.matchId, { type: 'state', state: result.state });
      } else if (msg.type === 'combat_action') {
        const action = String(msg.action ?? '').toUpperCase();
        if (!(COMBAT_ACTIONS as readonly string[]).includes(action)) {
          hub.send(socket, { type: 'error', error: 'Acción de combate inválida' });
          return;
        }
        if (!isLocal && !controlsCombatTurn(game, ctx.slot!)) {
          hub.send(socket, { type: 'error', error: 'No es el turno de tu Pokémon' });
          return;
        }
        const result = game.combatAction(action as (typeof COMBAT_ACTIONS)[number]);
        if (!result.ok) {
          hub.send(socket, { type: 'error', error: result.error });
          return;
        }
        await persist();
        hub.broadcast(ctx.matchId, { type: 'state', state: result.state });
      } else if (msg.type === 'combat_continue') {
        const result = game.continueCombat();
        if (!result.ok) {
          hub.send(socket, { type: 'error', error: result.error });
          return;
        }
        await persist();
        hub.broadcast(ctx.matchId, { type: 'state', state: result.state });
      } else if (msg.type === 'end_turn') {
        const result = isLocal ? game.endTurn() : game.endTurn(actor!);
        if (!result.ok) {
          hub.send(socket, { type: 'error', error: result.error });
          return;
        }
        await persist();
        hub.broadcast(ctx.matchId, { type: 'state', state: result.state });
      } else if (msg.type === 'abandon') {
        const result = isLocal ? game.abandon() : game.abandon(actor!);
        if (!result.ok) {
          hub.send(socket, { type: 'error', error: result.error });
          return;
        }
        await persist();
        hub.broadcast(ctx.matchId, { type: 'state', state: result.state });
      }
    });

    const onGone = () => {
      const ctx = hub.ctxOf(socket);
      hub.leave(socket);
      if (ctx && ctx.matchId !== LOCAL_ROOM && ctx.userId) {
        void RoomService.handleDisconnect(ctx.matchId, ctx.userId);
      }
    };
    socket.on('close', onGone);
    socket.on('error', onGone);
  });
}
