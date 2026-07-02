import type { RoomInfo } from '@transcendence/shared';
import { authState } from '../auth/AuthState';

/**
 * Cliente WSS del frontend. Recibe difusiones autoritativas del game-service
 * (`state`, `room`, `chat`) y las entrega al controlador. Reconecta
 * automáticamente a la MISMA sala. No envía movimientos por aquí (van vía
 * REST, que también difunde por WSS).
 */
export interface WsMessage {
  type: 'state' | 'room' | 'room_closed' | 'chat' | 'error';
  state?: unknown;
  room?: RoomInfo;
  matchId?: string;
  combat?: unknown;
  text?: string;
  error?: string;
}

export class WsClient {
  private ws: WebSocket | null = null;
  private closedByUser = false;
  private matchId: string | null = null;
  private onMessage: (msg: WsMessage) => void;

  constructor(onMessage: (msg: WsMessage) => void) {
    this.onMessage = onMessage;
  }

  /** Sin `matchId` conecta a la sala local (hot-seat); con él, a la sala online.
   *  El token (JWT) se envía SIEMPRE por query string: el servidor exige auth
   *  para abrir el socket en ambos modos. */
  connect(matchId?: string): void {
    this.matchId = matchId ?? null;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const params = new URLSearchParams();
    if (this.matchId) params.set('matchId', this.matchId);
    params.set('token', authState.sessionToken ?? '');
    const url = `${proto}://${location.host}/ws?${params.toString()}`;
    try {
      this.ws = new WebSocket(url);
    } catch {
      return;
    }
    this.ws.onmessage = (e) => {
      try {
        this.onMessage(JSON.parse(e.data) as WsMessage);
      } catch {
        /* ignora mensajes no-JSON */
      }
    };
    this.ws.onclose = () => {
      if (!this.closedByUser) {
        window.setTimeout(() => this.connect(this.matchId ?? undefined), 2000);
      }
    };
    this.ws.onerror = () => this.ws?.close();
  }

  sendChat(text: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'chat', text }));
    }
  }

  close(): void {
    this.closedByUser = true;
    this.ws?.close();
  }
}
