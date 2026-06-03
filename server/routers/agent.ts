/**
 * server/routers/agent.ts
 *
 * tRPC router for Agi-Suite → Stable bridge callbacks.
 * Auth: x-agent-token header (machine-to-machine, NOT user JWT).
 * Token must match AGENT_SERVICE_TOKEN across Stable / Agi-Suite / Agent-OS.
 *
 * Procedures (mutations — bridge pushes results in):
 *   agent.decisions      — AI mix decision set from aiMixEngine
 *   agent.mix            — completed mix result
 *   agent.diagnostics    — troubleshoot handler output
 *   agent.vocalspectra   — VocalSpectra analysis result
 */

import { z }          from 'zod';
import { TRPCError }  from '@trpc/server';
import { router, publicProc, middleware } from '../trpc';

// ── Agent token middleware ────────────────────────────────────────────────────

const AGENT_TOKEN = process.env.AGENT_SERVICE_TOKEN;

const requireAgentToken = middleware(({ ctx, next }) => {
  if (!AGENT_TOKEN) {
    process.stderr.write(
      '[agent-router] AGENT_SERVICE_TOKEN not set — rejecting all agent calls\n'
    );
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Agent token not configured on server',
    });
  }
  const incoming = ctx.req.headers['x-agent-token'];
  if (!incoming || incoming !== AGENT_TOKEN) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid agent token' });
  }
  return next({ ctx });
});

const agentProcedure = publicProc.use(requireAgentToken);

// ── Input schemas ─────────────────────────────────────────────────────────────

const decisionSchema = z.object({
  sessionId:  z.string(),
  agentId:    z.string(),
  decisions:  z.array(z.object({
    trackId:    z.string(),
    parameter:  z.string(),
    value:      z.number(),
    confidence: z.number().min(0).max(1),
  })),
  timestamp:  z.number(),
});

const mixResultSchema = z.object({
  sessionId:  z.string(),
  agentId:    z.string(),
  trackIds:   z.array(z.string()),
  targetLUFS: z.number().optional(),
  genre:      z.string().optional(),
  result:     z.record(z.unknown()),
  timestamp:  z.number(),
});

const diagnosticsSchema = z.object({
  sessionId: z.string(),
  agentId:   z.string(),
  symptoms:  z.array(z.string()),
  findings:  z.array(z.object({
    code:     z.string(),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    message:  z.string(),
    fix:      z.string().optional(),
  })),
  timestamp: z.number(),
});

const vocalSpectraSchema = z.object({
  sessionId:    z.string(),
  agentId:      z.string(),
  trackId:      z.string(),
  analysisMode: z.enum(['realtime', 'offline']).optional(),
  spectrum:     z.record(z.unknown()),
  timestamp:    z.number(),
});

// ── Router ────────────────────────────────────────────────────────────────────

export const agentRouter = router({
  decisions: agentProcedure
    .input(decisionSchema)
    .mutation(({ input }) => {
      process.stderr.write(
        `[agent-router] decisions agentId=${input.agentId} sessionId=${input.sessionId} count=${input.decisions.length}\n`
      );
      // TODO: forward to LLPTE transitionGraph or store in aiDecisionLog
      return { ok: true, agentId: input.agentId };
    }),

  mix: agentProcedure
    .input(mixResultSchema)
    .mutation(({ input }) => {
      process.stderr.write(
        `[agent-router] mix agentId=${input.agentId} sessionId=${input.sessionId}\n`
      );
      return { ok: true, agentId: input.agentId };
    }),

  diagnostics: agentProcedure
    .input(diagnosticsSchema)
    .mutation(({ input }) => {
      const critCount = input.findings.filter(f => f.severity === 'critical').length;
      process.stderr.write(
        `[agent-router] diagnostics agentId=${input.agentId} findings=${input.findings.length} critical=${critCount}\n`
      );
      return { ok: true, agentId: input.agentId };
    }),

  vocalspectra: agentProcedure
    .input(vocalSpectraSchema)
    .mutation(({ input }) => {
      process.stderr.write(
        `[agent-router] vocalspectra agentId=${input.agentId} trackId=${input.trackId}\n`
      );
      return { ok: true, agentId: input.agentId };
    }),
});

export type AgentRouter = typeof agentRouter;
