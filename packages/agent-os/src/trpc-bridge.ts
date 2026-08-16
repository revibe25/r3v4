/**
 * src/trpc-bridge.ts
 *
 * Bridge for Agent-OS to Stable: Sends mix decisions, diagnostics, and results
 * back to the R3 Native DAW via tRPC and x-agent-token auth.
 */

import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import { MixResultInput, DiagnosticsInput, AgentLogger } from './types.js';
import { ConsoleLogger } from './sdk/index.js';

// ── Stable Bridge Client ──────────────────────────────────────────────────────

export class StableBridge {
  private client: any;
  private logger: AgentLogger;
  private token: string;

  constructor(
    stableUrl: string = 'http://localhost:3000',
    agentToken: string = process.env.AGENT_SERVICE_TOKEN || '',
    logger?: AgentLogger
  ) {
    this.token = agentToken;
    this.logger = logger || new ConsoleLogger('[StableBridge]');

    if (!this.token) {
      this.logger.warn('AGENT_SERVICE_TOKEN not provided; callbacks will fail auth');
    }

    this.client = createTRPCProxyClient<any>({
      links: [
        httpBatchLink({
          url: `${stableUrl}/trpc`,
          headers: () => ({
            'x-agent-token': this.token,
            'content-type': 'application/json',
          }),
          async fetch(url, options) {
            const response = await fetch(url, options);
            if (!response.ok) {
              const text = await response.text();
              throw new Error(`tRPC request failed: ${response.status} - ${text}`);
            }
            return response;
          },
        }),
      ],
    });
  }

  /**
   * Send mix decisions to Stable
   */
  async sendMixResult(result: MixResultInput): Promise<{ ok: boolean; agentId: string }> {
    try {
      this.logger.debug('Sending mix result', {
        agentId: result.agentId,
        decisions: result.decisions.length,
      });

      const response = await this.client.agent.mix.mutate(result);

      this.logger.info('Mix result sent successfully', { agentId: result.agentId });

      return response;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.logger.error('Failed to send mix result', { error });
      throw err;
    }
  }

  /**
   * Send diagnostics to Stable
   */
  async sendDiagnostics(diagnostics: DiagnosticsInput): Promise<{ ok: boolean; agentId: string }> {
    try {
      this.logger.debug('Sending diagnostics', {
        agentId: diagnostics.agentId,
        findings: diagnostics.findings.length,
      });

      const response = await this.client.agent.diagnostics.mutate(diagnostics);

      this.logger.info('Diagnostics sent successfully', { agentId: diagnostics.agentId });

      return response;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.logger.error('Failed to send diagnostics', { error });
      throw err;
    }
  }

  /**
   * Send mix decisions (decisions mutation)
   */
  async sendDecisions(input: {
    sessionId: string;
    agentId: string;
    decisions: Array<{
      trackId: string;
      parameter: string;
      value: number;
      confidence: number;
    }>;
    timestamp: number;
  }): Promise<{ ok: boolean; agentId: string }> {
    try {
      this.logger.debug('Sending decisions', {
        agentId: input.agentId,
        count: input.decisions.length,
      });

      const response = await this.client.agent.decisions.mutate(input);

      this.logger.info('Decisions sent successfully', { agentId: input.agentId });

      return response;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.logger.error('Failed to send decisions', { error });
      throw err;
    }
  }

  /**
   * Send vocal spectra analysis
   */
  async sendVocalSpectra(input: {
    sessionId: string;
    agentId: string;
    trackId: string;
    analysisMode?: 'realtime' | 'offline';
    spectrum: Record<string, unknown>;
    timestamp: number;
  }): Promise<{ ok: boolean; agentId: string }> {
    try {
      this.logger.debug('Sending vocal spectra', {
        agentId: input.agentId,
        trackId: input.trackId,
      });

      const response = await this.client.agent.vocalspectra.mutate(input);

      this.logger.info('Vocal spectra sent successfully', { agentId: input.agentId });

      return response;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.logger.error('Failed to send vocal spectra', { error });
      throw err;
    }
  }

  /**
   * Health check: verify bridge connectivity
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.agent.decisions.mutate({
        sessionId: 'health-check',
        agentId: 'health-check',
        decisions: [],
        timestamp: Date.now(),
      });

      this.logger.info('Health check passed', { response });
      return response.ok;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.logger.error('Health check failed', { error });
      return false;
    }
  }
}
