export type MessageHandler = (data: any) => void;

export class WSClient {
  private ws: WebSocket | null = null;
  private url: string;
  private handlers = new Map<string, MessageHandler[]>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private visitorId: string;
  private destroyed = false;

  constructor(url: string, visitorId: string) {
    this.url = url;
    this.visitorId = visitorId;
  }

  connect() {
    const sep = this.url.includes('?') ? '&' : '?';
    this.ws = new WebSocket(`${this.url}${sep}visitorId=${this.visitorId}`);

    this.ws.onopen = () => {
      this.reconnectDelay = 1000;
      this.emit('_open', {});
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.emit(data.type, data);
      } catch {}
    };

    this.ws.onclose = () => {
      this.emit('_close', {});
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer || this.destroyed) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
  }

  send(type: string, data: Record<string, any> = {}) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, ...data }));
    }
  }

  on(type: string, handler: MessageHandler) {
    if (!this.handlers.has(type)) this.handlers.set(type, []);
    this.handlers.get(type)!.push(handler);
  }

  off(type: string, handler: MessageHandler) {
    const list = this.handlers.get(type);
    if (list) {
      this.handlers.set(type, list.filter((h) => h !== handler));
    }
  }

  private emit(type: string, data: any) {
    for (const h of this.handlers.get(type) || []) h(data);
    for (const h of this.handlers.get('*') || []) h({ ...data, _type: type });
  }

  disconnect() {
    this.destroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.ws?.close();
    this.ws = null;
  }
}
