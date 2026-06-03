/**
 * WebSocket handler for real-time agent DSP param injection.
 */
import { WebSocketServer, WebSocket } from 'ws';

const AGENT_TOKEN = process.env.AGENT_SERVICE_TOKEN!;

interface AuthedSocket extends WebSocket {
  agentId?: string;
  authed?:  boolean;
}

type DSPParamCallback = (agentId: string, nodeId: string, param: string, value: number) => void;

export function createAgentWSHandler(
  wss: WebSocketServer,
  onDSPParam: DSPParamCallback = defaultDSPParamHandler,
): void {
  wss.on('connection', (ws: AuthedSocket) => {
    const authTimer = setTimeout(() => {
      if (!ws.authed) {
        ws.close(4401, 'Authentication timeout');
      }
    }, 5_000);

    ws.on('message', (raw) => {
      let msg: any;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (msg.type === 'agent:auth') {
        if (msg.token !== AGENT_TOKEN || !msg.agentId) {
          ws.send(JSON.stringify({ type: 'agent:auth:error', error: 'Invalid token' }));
          ws.close(4403, 'Forbidden');
          return;
        }

        ws.authed  = true;
        ws.agentId = msg.agentId;
        clearTimeout(authTimer);

        ws.send(JSON.stringify({ type: 'agent:auth:ack', agentId: msg.agentId }));
        console.log(`[AgentWS] Agent authenticated: ${msg.agentId}`);
        return;
      }

      if (!ws.authed) {
        ws.close(4401, 'Not authenticated');
        return;
      }

      if (msg.type === 'dsp:param' && typeof msg.nodeId === 'string') {
        onDSPParam(ws.agentId!, msg.nodeId, msg.param, msg.value);
      }
    });

    ws.on('close', () => {
      clearTimeout(authTimer);
      if (ws.agentId) console.log(`[AgentWS] Agent disconnected: ${ws.agentId}`);
    });
  });

  console.log('[AgentWS] Handler mounted');
}

function defaultDSPParamHandler(
  agentId: string,
  nodeId:  string,
  param:   string,
  value:   number,
): void {
  console.log(`[AgentWS] DSP param from ${agentId}: node=${nodeId} ${param}=${value}`);
}
