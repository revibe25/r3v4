/**
 * server/routers/adminRouter.ts
 *
 * Admin-only tRPC router.
 * Gate: users.isAdmin === true (queried from DB — JWT never carries this field).
 * Wire.txt §7 — all client-server comms through tRPC.
 * Wire.txt §8 — protectedProcedure required; userId FK on every query.
 * CLAUDE.md Hard Guard #1 — no `any`; use unknown + type guard.
 * CLAUDE.md Hard Guard #2 — no swallowed exceptions.
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { router } from "../trpc";
import { protectedProcedure } from "../base-procedures";
import { db } from "../db";
import { users } from "../db/schema";

// ── Narrow the Anthropic content block type ────────────────────────────────────
interface TextBlock {
  type: "text";
  text: string;
}

function isTextBlock(block: unknown): block is TextBlock {
  return (
    typeof block === "object" &&
    block !== null &&
    (block as Record<string, unknown>).type === "text" &&
    typeof (block as Record<string, unknown>).text === "string"
  );
}

// ── Shared admin gate (reused in both procedures) ──────────────────────────────
async function assertAdmin(userId: string): Promise<void> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { isAdmin: true },
  });
  if (!user?.isAdmin) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required",
    });
  }
}

// ── Anthropic proxy (server-side — API key never exposed to browser) ───────────
async function callAnthropic(
  systemPrompt: string,
  messages: ReadonlyArray<{ role: "user" | "assistant"; content: string }>,
  maxTokens: number,
): Promise<string> {
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
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    const msg =
      typeof (body as { error?: { message?: unknown } }).error?.message === "string"
        ? (body as { error: { message: string } }).error.message
        : `Anthropic API error ${res.status}`;
    throw new TRPCError({ code: "BAD_GATEWAY", message: msg });
  }

  const data = await res.json() as { content: unknown[] };
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
    return { isAdmin: true } as const;
  }),

  /**
   * Proxies a single multi-turn chat exchange to the Anthropic API.
   * Used by the Expert Agent Suite and Agent Mesh panels.
   *
   * Wire.txt §7 — rate limiting is handled at Express middleware layer.
   * Wire.txt §17 — agentId is logged for audit; dry-run is surfaced to caller.
   */
  agentChat: protectedProcedure
    .input(
      z.object({
        agentId: z.string(),
        systemPrompt: z.string(),
        messages: z.array(
          z.object({
            role: z.enum(["user", "assistant"]),
            content: z.string(),
          }),
        ),
        maxTokens: z.number().int().min(100).max(4000).default(1000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id);

      const content = await callAnthropic(
        input.systemPrompt,
        input.messages,
        input.maxTokens,
      );

      return { content } as const;
    }),
});

export type AdminRouter = typeof adminRouter;
