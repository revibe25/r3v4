/**
 * Service-to-service authentication guard for agent-injected endpoints.
 */
import { TRPCError } from '@trpc/server';
import { publicProc, middleware } from '../trpc';

const AGENT_TOKEN = process.env.AGENT_SERVICE_TOKEN;

if (!AGENT_TOKEN) {
  throw new Error('AGENT_SERVICE_TOKEN env var is required but not set');
}

const enforceAgentToken = middleware(({ ctx, next }: any) => {
  const token = ctx.req.headers['x-agent-token'];

  if (!token || token !== AGENT_TOKEN) {
    throw new TRPCError({
      code:    'UNAUTHORIZED',
      message: 'Invalid or missing agent service token',
    });
  }

  const agentId = ctx.req.headers['x-agent-id'] as string | undefined;

  return next({
    ctx: {
      ...ctx,
      agentId: agentId ?? 'unknown',
      isAgent: true,
    },
  });
});

export const agentProcedure = publicProc.use(enforceAgentToken);
