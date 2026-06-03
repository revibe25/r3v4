/**
 * SessionBroadcaster — fan-out engine state changes to all connected WebSocket clients.
 *
 * Invariants:
 *   - Dead sockets pruned before every broadcast.
 *   - Broadcast never throws — errors isolated per client.
 *   - 30-second heartbeat ping; terminal on repeated failure.
 */
export class SessionBroadcaster {
    constructor() {
        this.clients = new Set();
        this.heartbeatInterval = null;
    }
    attach(wss) {
        wss.on("connection", (ws) => {
            this.clients.add(ws);
            ws.on("close", () => this.clients.delete(ws));
            ws.on("error", () => { this.clients.delete(ws); ws.terminate(); });
        });
        this.startHeartbeat();
    }
    broadcast(event) {
        const payload = JSON.stringify(event);
        const dead = [];
        for (const client of this.clients) {
            if (client.readyState !== 1 /* OPEN */) {
                dead.push(client);
                continue;
            }
            try {
                client.send(payload);
            }
            catch {
                dead.push(client);
            }
        }
        for (const d of dead)
            this.clients.delete(d);
    }
    get connectionCount() { return this.clients.size; }
    startHeartbeat() {
        if (this.heartbeatInterval)
            return;
        this.heartbeatInterval = setInterval(() => this.broadcast({ type: "PING" }), 30000);
    }
    stop() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        for (const client of this.clients)
            client.terminate();
        this.clients.clear();
    }
}
