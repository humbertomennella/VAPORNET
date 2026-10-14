import type { ClientMessage, ServerMessage } from './protocol';

export class MultiplayerClient {
  private socket?: WebSocket;
  private listeners = new Set<(message: ServerMessage) => void>();
  connect(url: string, onStatus?: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void) {
    onStatus?.('connecting');
    this.socket = new WebSocket(url);
    this.socket.addEventListener('open', () => onStatus?.('connected'));
    this.socket.addEventListener('close', () => onStatus?.('disconnected'));
    this.socket.addEventListener('error', () => onStatus?.('error'));
    this.socket.addEventListener('message', event => {
      try {
        const parsed = JSON.parse(String(event.data)) as ServerMessage;
        this.listeners.forEach(listener => listener(parsed));
      } catch { /* Ignore malformed server frames; never crash the UI on network input. */ }
    });
  }
  send(message: ClientMessage) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
    else throw new Error('Não conectado ao servidor multiplayer.');
  }
  subscribe(listener: (message: ServerMessage) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  disconnect() { this.socket?.close(); this.socket = undefined; }
}
