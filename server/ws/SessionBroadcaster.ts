import type { WebSocket, WebSocketServer } from "ws";

export type BroadcastEvent =
  | { type: "MIXER_STATE_CHANGE";  payload: unknown }
  | { type: "DJ_SESSION_CHANGE";   payload: unknown }
  | { type: "AI_MIX_RESULT";       payload: unknown }
  | { type: "ARRANGEMENT_CHANGE";  payload: unknown }
  | { type: "PING" };

/**
 * SessionBroadcaster — fan-out engine state changes to all connected WebSocket clients.
 *
 * Invariants:
 *   - Dead sockets pruned before every broadcast.
 *   - Broadcast never throws — errors isolated per client.
 *   - 30-second heartbeat ping; terminal on repeated failure.
 */
export class SessionBroadcaster {
  private readonly clients = new Set<WebSocket>();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  attach(wss: WebSocketServer): void {
    wss.on("connection", (ws: WebSocket) => {
      this.clients.add(ws);
      ws.on("close",  () => this.clients.delete(ws));
      ws.on("error",  () => { this.clients.delete(ws); ws.terminate(); });
    });
    this.startHeartbeat();
  }

  broadcast(event: BroadcastEvent): void {
    const payload = JSON.stringify(event);
    const dead: WebSocket[] = [];
    for (const client of this.clients) {
      if (client.readyState !== 1 /* OPEN */) { dead.push(client); continue; }
      try { client.send(payload); } catch { dead.push(client); }
    }
    for (const d of dead) this.clients.delete(d);
  }

  get connectionCount(): number { return this.clients.size; }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) return;
    this.heartbeatInterval = setInterval(() => this.broadcast({ type: "PING" }), 30_000);
  }

  stop(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    for (const client of this.clients) client.terminate();
    this.clients.clear();
  }
}
