import type { RoomInfo, MatchStateDTO } from '@transcendence/shared';

/**
 * Cliente WSS del frontend. Recibe difusiones autoritativas del game-service
 * (`state`, `room`, `chat`) y las entrega al controlador. Reconecta
 * automáticamente a la MISMA sala. No envía movimientos por aquí (van vía
 * REST, que también difunde por WSS).
 */
export interface DmHistoryMessage {
  from_id: string;
  text: string;
  created_at: string;
}

export interface WsMessage {
  type: 'state' | 'room' | 'room_closed' | 'chat' | 'chat_history' | 'error';
  state?: MatchStateDTO;
  room?: RoomInfo;
  matchId?: string;
  combat?: unknown;
  text?: string;
  /** Chat DM: id del emisor y timestamp (mensajes en vivo). */
  from?: string;
  at?: string;
  /** Historial persistente enviado al abrir un chat DM. */
  messages?: DmHistoryMessage[];
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

  private retries = 0;

  /** Sin `matchId` conecta a la sala local (hot-seat); con él, a la sala online.
   *  La sesión se autentica con la cookie HttpOnly (enviada en el handshake al
   *  ser mismo origen); ya NO se pasa el token por query string. */
  connect(matchId?: string): void {
    this.matchId = matchId ?? null;
    this.closedByUser = false;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const params = new URLSearchParams();
    if (this.matchId) params.set('matchId', this.matchId);
    const qs = params.toString();
    const url = `${proto}://${location.host}/ws${qs ? `?${qs}` : ''}`;
    try {
      this.ws = new WebSocket(url);
    } catch {
      return;
    }
    this.ws.onopen = () => {
      this.retries = 0;
    };
    this.ws.onmessage = (e) => {
      try {
        this.onMessage(JSON.parse(e.data) as WsMessage);
      } catch {
        /* ignora mensajes no-JSON */
      }
    };
    this.ws.onclose = () => {
      if (this.closedByUser || this.retries >= 6) return;
      // Backoff exponencial con tope (evita reconexión indefinida a 2s).
      const delay = Math.min(1000 * 2 ** this.retries, 30000);
      this.retries++;
      window.setTimeout(() => this.connect(this.matchId ?? undefined), delay);
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
