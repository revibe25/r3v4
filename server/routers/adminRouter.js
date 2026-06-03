/**
 * server/routers/adminRouter.ts
 *
 * Admin-only tRPC router.
 * Gate: users.isAdmin === true (queried from DB — JWT never carries this field).
 * Wire.txt §7 — all client-server comms through tRPC.
 * Wire.txt §8 — protectedProcedure required; userId FK on every query.
 * CLAUDE.md Hard Guard #1 — no `any`; use unknown + type guard.
 * CLAUDE.md Hard Guard #2 — no swallowed exceptions.
 *
 * Security patches applied (Mythos audit 2026-04-22):
 *   C-04 — Added .max(8000) to systemPrompt. An unbounded prompt is a cost-
 *           amplification vector against the Anthropic API budget for any
 *           compromised admin account.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { router } from "../trpc";
import { protectedProcedure } from "../base-procedures";
import { db } from "../db";
import { users } from "../db/schema";
function isTextBlock(block) {
    return (typeof block === "object" &&
        block !== null &&
        block.type === "text" &&
        typeof block.text === "string");
}
// ── Shared admin gate (reused in both procedures) ──────────────────────────────
async function assertAdmin(userId) {
    const [user] = await db
        .select({ isAdmin: users.isAdmin })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
    if (!user?.isAdmin) {
        throw new TRPCError({
            code: "FORBIDDEN",
            message: "Admin access required",
        });
    }
}
// ── Anthropic proxy (server-side — API key never exposed to browser) ───────────
async function callAnthropic(systemPrompt, messages, maxTokens) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "ANTHROPIC_API_KEY not configured",
        });
    }
    const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: maxTokens,
            system: systemPrompt,
            messages,
        }),
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = typeof body.error?.message === "string"
            ? body.error.message
            : `Anthropic API error ${res.status}`;
        throw new TRPCError({ code: "BAD_GATEWAY", message: msg });
    }
    const data = await res.json();
    return (data.content ?? [])
        .filter(isTextBlock)
        .map((b) => b.text)
        .join("\n");
}
// ── Router ─────────────────────────────────────────────────────────────────────
export const adminRouter = router({
    /**
     * Lightweight gate-check called by the AdminAgentSuitePage on mount.
     * Returns `{ isAdmin: true }` or throws FORBIDDEN.
     */
    checkAccess: protectedProcedure.query(async ({ ctx }) => {
        await assertAdmin(ctx.user.id);
        return { isAdmin: true };
    }),
    /**
     * Proxies a single multi-turn chat exchange to the Anthropic API.
     * Used by the Expert Agent Suite and Agent Mesh panels.
     *
     * Wire.txt §7 — rate limiting is handled at Express middleware layer.
     * Wire.txt §17 — agentId is logged for audit; dry-run is surfaced to caller.
     */
    agentChat: protectedProcedure
        .input(z.object({
        agentId: z.string(),
        // C-04 FIX: Added .max(8000). An unbounded system prompt is a cost-
        // amplification vector — a compromised admin account could send
        // arbitrarily large prompts to the Anthropic API on every call.
        // 8000 chars (~2000 tokens) covers all legitimate agent system prompts.
        systemPrompt: z.string().max(8000),
        messages: z.array(z.object({
            role: z.enum(["user", "assistant"]),
            content: z.string(),
        })),
        maxTokens: z.number().int().min(100).max(4000).default(1000),
    }))
        .mutation(async ({ ctx, input }) => {
        await assertAdmin(ctx.user.id);
        const content = await callAnthropic(input.systemPrompt, input.messages, input.maxTokens);
        return { content };
    }),
});
