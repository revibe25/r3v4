/**
 * Receives agent-injected diagnostic findings and migration status queries.
 * All endpoints guarded by agentProcedure (service-to-service token).
 */
import { router } from '../trpc';
import { agentProcedure } from '../middleware/agentAuth';
import { z } from 'zod';
const FindingSchema = z.object({
    severity: z.enum(['info', 'warn', 'error', 'critical']),
    category: z.string().min(1).max(100),
    message: z.string().min(1).max(2000),
    fix: z.string().max(2000).optional(),
    autoApply: z.boolean().optional(),
});
const IngestSchema = z.object({
    sessionId: z.string().nullable(),
    projectId: z.string().nullable(),
    agentId: z.string().uuid(),
    findings: z.array(FindingSchema).min(1).max(100),
});
export const diagnosticsRouter = router({
    ingestAgentFindings: agentProcedure
        .input(IngestSchema)
        .mutation(async ({ input, ctx }) => {
        return {
            ingested: input.findings.length,
            autoApplied: 0,
            categories: [],
        };
    }),
    getMigrationStatus: agentProcedure
        .query(async () => {
        return {
            upToDate: true,
            pendingCount: 0,
            pending: [],
            aiDecisionLogMissing: false,
        };
    }),
});
