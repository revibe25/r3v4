/**
 * server/ws-agent.ts
 *
 * WebSocket server for real-time DSP param push from Agi-Suite → Stable.
 * Mounts at /ws/agent on the existing HTTP server (no new port).
 * Auth: x-agent-token header on the upgrade handshake.
 *
 * Message format (JSON, server→client after params arrive):
 *   { type: "dsp_params", sessionId: string, params: Record<string, number>, ts: number }
 *
 * Usage in server/index.ts:
 *   import { mountAgentWS } from './server/ws-agent';
 *   mountAgentWS(httpServer);
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';

const AGENT_TOKEN = process.env.AGENT_SERVICE_TOKEN;

/** Broadcast a DSP param update to all connected DAW clients (future use). */
export function broadcastDSPParams(
  sessionId: string,
  params: Record<string, number>
): void {
  const msg = JSON.stringify({ type: 'dsp_params', sessionId, params, ts: Date.now() });
  for (const client of _clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

const _clients = new Set<WebSocket>();

export function mountAgentWS(server: Server): void {
  if (!AGENT_TOKEN) {
    process.stderr.write(
      '[ws-agent] AGENT_SERVICE_TOKEN not set — WebSocket agent endpoint disabled\n'
    );
    return;
  }

  const wss = new WebSocketServer({ server, path: '/ws/agent' });

  wss.on('connection', (ws, req) => {
    // Validate token from upgrade headers
    const incoming =
      req.headers['x-agent-token'] ??
      // Some WS clients send custom headers as query params as a fallback
      new URL(req.url ?? '', 'http://localhost').searchParams.get('token');

    if (!incoming || incoming !== AGENT_TOKEN) {
      ws.close(4001, 'Unauthorized');
      return;
    }

    _clients.add(ws);
    process.stderr.write('[ws-agent] agent connected\n');

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as {
          type: string;
          sessionId?: string;
          params?: Record<string, number>;
        };

        if (msg.type === 'dsp_params' && msg.sessionId && msg.params) {
          broadcastDSPParams(msg.sessionId, msg.params);
        } else {
          process.stderr.write(`[ws-agent] unknown message type: ${msg.type}\n`);
        }
      } catch {
        process.stderr.write('[ws-agent] invalid JSON message received\n');
      }
    });

    ws.on('close', () => {
      _clients.delete(ws);
      process.stderr.write('[ws-agent] agent disconnected\n');
    });

    ws.on('error', (err) => {
      process.stderr.write(`[ws-agent] error: ${err.message}\n`);
      _clients.delete(ws);
    });
  });

  process.stderr.write('[ws-agent] WebSocket agent endpoint mounted at /ws/agent\n');
}
