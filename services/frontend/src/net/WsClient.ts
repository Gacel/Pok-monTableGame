/**
 * Cliente WSS del frontend. Recibe difusiones autoritativas del game-service
 * (`state`, `chat`) y las entrega al controlador. Reconecta automáticamente.
 * No envía movimientos por aquí (se usan vía REST, que también difunden por WSS).
 */
export interface WsMessage {
  type: 'state' | 'chat' | 'error';
  state?: unknown;
  combat?: unknown;
  text?: string;
  error?: string;
}

export class WsClient {
  private ws: WebSocket | null = null;
  private closedByUser = false;
  private onMessage: (msg: WsMessage) => void;

  constructor(onMessage: (msg: WsMessage) => void) {
    this.onMessage = onMessage;
  }

  connect(): void {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${proto}://${location.host}/ws`;
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
      if (!this.closedByUser) window.setTimeout(() => this.connect(), 2000);
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
