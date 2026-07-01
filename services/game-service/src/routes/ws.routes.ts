import { FastifyInstance } from 'fastify';
import type { SocketStream } from '@fastify/websocket';
import { matchManager } from '../services/MatchManager.js';
import { hub } from '../realtime/hub.js';
import { Hex } from '../engine/hex.js';

interface WsMessage {
  type: 'move' | 'chat';
  from?: Hex;
  to?: Hex;
  text?: string;
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
 * Sincronización de tablero + chat por WSS. El servidor valida cada `move` con el
 * motor ANTES de actualizar y difundir el estado a toda la sala.
 */
export async function wsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/ws', { websocket: true }, (connection: SocketStream) => {
    const socket = connection.socket;
    hub.add(socket);

    // Envía el estado actual al conectar.
    hub.send(socket, { type: 'state', state: matchManager.get().getStateDTO() });

    socket.on('message', async (raw: Buffer) => {
      let msg: WsMessage;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        hub.send(socket, { type: 'error', error: 'JSON inválido' });
        return;
      }

      if (msg.type === 'move') {
        if (!isHex(msg.from) || !isHex(msg.to)) {
          hub.send(socket, { type: 'error', error: 'Coordenadas inválidas' });
          return;
        }
        const game = matchManager.get();
        const actor = game.getStateDTO().currentPlayer;
        const result = game.play(actor, msg.from, msg.to);
        if (!result.ok) {
          hub.send(socket, { type: 'error', error: result.error });
          return;
        }
        await matchManager.persist();
        hub.broadcast({ type: 'state', state: result.state, combat: result.combat ?? null });
      } else if (msg.type === 'chat') {
        const text = (msg.text ?? '').toString().slice(0, 200);
        if (text.trim()) hub.broadcast({ type: 'chat', text });
      }
    });

    socket.on('close', () => hub.remove(socket));
    socket.on('error', () => hub.remove(socket));
  });
}
