import type { WebSocket } from 'ws';

/**
 * Hub de tiempo real: mantiene las conexiones WSS abiertas de la sala (partida)
 * y difunde mensajes. El servidor valida ANTES de difundir → autoridad del servidor.
 */
class RealtimeHub {
  private sockets: Set<WebSocket> = new Set();

  add(socket: WebSocket): void {
    this.sockets.add(socket);
  }

  remove(socket: WebSocket): void {
    this.sockets.delete(socket);
  }

  get size(): number {
    return this.sockets.size;
  }

  /** Envía un objeto (serializado a JSON) a todos los clientes conectados. */
  broadcast(message: unknown): void {
    const payload = JSON.stringify(message);
    for (const socket of this.sockets) {
      // 1 === WebSocket.OPEN
      if (socket.readyState === 1) {
        try {
          socket.send(payload);
        } catch {
          this.sockets.delete(socket);
        }
      }
    }
  }

  /** Envía a un único socket. */
  send(socket: WebSocket, message: unknown): void {
    if (socket.readyState === 1) socket.send(JSON.stringify(message));
  }
}

export const hub = new RealtimeHub();
