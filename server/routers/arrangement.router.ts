/**
 * server/routers/arrangement.router.ts
 * tRPC CRUD router for arrangements. All routes require authentication.
 */
import { z } from "zod";
import { router } from "../trpc";
import { protectedProcedure } from "../base-procedures";
import {
  createArrangement, getArrangement,
  listArrangements, updateArrangement, deleteArrangement,
} from "../services/arrangement.service";

export const arrangementRouter = router({
  list: protectedProcedure.query(async ({ ctx }: { ctx: any }) =>
    listArrangements(ctx.user!.id)
  ),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }: { ctx: any; input: any }) => {
      const a = await getArrangement(input.id);
      if (!a) throw new Error(`Arrangement ${input.id} not found`);
      return a;
    }),

  create: protectedProcedure
    .input(z.object({ name: z.string().optional() }))
    .mutation(async ({ ctx, input }: { ctx: any; input: any }) =>
      createArrangement(ctx.user!.id, input.name)
    ),

  update: protectedProcedure
    .input(z.object({
      id:    z.string(),
      patch: z.object({
        name:          z.string().optional(),
        tempo:         z.number().min(20).max(999).optional(),
        timeSignature: z.object({
          numerator:   z.number().min(1).max(16),
          denominator: z.number().min(1).max(16),
        }).optional(),
        lengthBars: z.number().min(1).optional(),
      }),
    }))
    .mutation(async ({ ctx, input }: { ctx: any; input: any }) => {
      const updated = await updateArrangement(input.id, input.patch);
      if (!updated) throw new Error(`Arrangement ${input.id} not found`);
      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }: { ctx: any; input: any }) => {
      const deleted = await deleteArrangement(input.id);
      if (!deleted) throw new Error(`Arrangement ${input.id} not found`);
      return { success: true };
    }),
});

export type ArrangementRouter = typeof arrangementRouter;

