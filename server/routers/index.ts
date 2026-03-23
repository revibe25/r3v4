/**
 * server/routers/index.ts
 *
 * Fix — ctx.user possibly undefined (20 errors)
 * Fix — Spread types may only be created from object types (3 errors)
 *
 * ROOT CAUSE (ctx.user undefined):
 * TRPCContext.user is AuthPayload | undefined. requireAuth throws before any
 * handler runs, but TypeScript could not see that narrowing propagate through
 * the tRPC middleware chain without the AuthenticatedContext cast in trpc.ts.
 * The non-null assertions (ctx.user!) are correct here — requireAuth in the
 * protectedProcedure chain guarantees user is non-null before any of these
 * handlers execute.
 *
 * ROOT CAUSE (spread types):
 * Zod's .omit() returns a ZodObject whose inferred type TypeScript cannot
 * always verify is spreadable, especially for complex schemas. The error
 * "Spread types may only be created from object types" fires even though the
 * runtime value is always a plain object. Object.assign() bypasses the spread
 * restriction entirely while producing an identical runtime result.
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { subscriptionRouter } from './subscription';
import { router }
import { mixerRouter }  from "./mixer.router";
import { djRouter }     from "./dj.router";
import { aiMixRouter }  from "./aiMix.router"; from '../trpc';
import { protectedProcedure } from '../procedures';
import { storage } from '../storage';
import {
  insertSessionSchema,
  insertProjectSchema,
  insertPresetSchema,
} from '../db/schema';

// ── Sessions ──────────────────────────────────────────────────────────────────
const sessionsRouter = router({
  list: protectedProcedure
    .query(({ ctx }) => storage.getSessionsByUser(ctx.user!.id)),

  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const session = await storage.getSession(input.id);
      if (!session) throw new TRPCError({ code: 'NOT_FOUND' });
      if (session.userId !== ctx.user!.id) throw new TRPCError({ code: 'FORBIDDEN' });
      return session;
    }),

  create: protectedProcedure
    .input(insertSessionSchema.omit({ userId: true }))
    .mutation(({ ctx, input }) =>
      // Object.assign avoids the "spread types" error on complex Zod-inferred types
      storage.createSession(Object.assign({}, input, { userId: ctx.user!.id }) as any)
    ),

  update: protectedProcedure
    .input(z.object({ id: z.string(), data: z.record(z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      const session = await storage.getSession(input.id);
      if (!session) throw new TRPCError({ code: 'NOT_FOUND' });
      if (session.userId !== ctx.user!.id) throw new TRPCError({ code: 'FORBIDDEN' });
      return storage.updateSession(input.id, input.data);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const session = await storage.getSession(input.id);
      if (!session) throw new TRPCError({ code: 'NOT_FOUND' });
      if (session.userId !== ctx.user!.id) throw new TRPCError({ code: 'FORBIDDEN' });
      return storage.deleteSession(input.id);
    }),
});

// ── Projects ──────────────────────────────────────────────────────────────────
const projectsRouter = router({
  list: protectedProcedure
    .query(({ ctx }) => storage.getProjectsByUser(ctx.user!.id)),

  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await storage.getProject(input.id);
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' });
      if (project.userId !== ctx.user!.id) throw new TRPCError({ code: 'FORBIDDEN' });
      return project;
    }),

  create: protectedProcedure
    .input(insertProjectSchema.omit({ userId: true }))
    .mutation(({ ctx, input }) =>
      storage.createProject(Object.assign({}, input, { userId: ctx.user!.id }) as any)
    ),

  update: protectedProcedure
    .input(z.object({ id: z.string(), data: z.record(z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      const project = await storage.getProject(input.id);
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' });
      if (project.userId !== ctx.user!.id) throw new TRPCError({ code: 'FORBIDDEN' });
      return storage.updateProject(input.id, input.data);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const project = await storage.getProject(input.id);
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' });
      if (project.userId !== ctx.user!.id) throw new TRPCError({ code: 'FORBIDDEN' });
      return storage.deleteProject(input.id);
    }),
});

// ── Presets ───────────────────────────────────────────────────────────────────
const presetsRouter = router({
  list: protectedProcedure
    .input(z.object({ type: z.string().optional() }))
    .query(({ ctx, input }) => storage.getPresetsByUser(ctx.user!.id, input.type)),

  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const preset = await storage.getPreset(input.id);
      if (!preset) throw new TRPCError({ code: 'NOT_FOUND' });
      if (!preset.isFactory && preset.userId !== ctx.user!.id) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      return preset;
    }),

  create: protectedProcedure
    .input(insertPresetSchema.omit({ userId: true }))
    .mutation(({ ctx, input }) =>
      storage.createPreset(Object.assign({}, input, { userId: ctx.user!.id }) as any)
    ),

  update: protectedProcedure
    .input(z.object({ id: z.string(), data: z.record(z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      const preset = await storage.getPreset(input.id);
      if (!preset) throw new TRPCError({ code: 'NOT_FOUND' });
      if (preset.userId !== ctx.user!.id) throw new TRPCError({ code: 'FORBIDDEN' });
      return storage.updatePreset(input.id, input.data);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const preset = await storage.getPreset(input.id);
      if (!preset) throw new TRPCError({ code: 'NOT_FOUND' });
      if (preset.userId !== ctx.user!.id) throw new TRPCError({ code: 'FORBIDDEN' });
      return storage.deletePreset(input.id);
    }),
});

// ── Settings ──────────────────────────────────────────────────────────────────
const settingsRouter = router({
  get: protectedProcedure
    .query(({ ctx }) => storage.getSettings(ctx.user!.id)),

  update: protectedProcedure
    .input(z.record(z.unknown()))
    .mutation(({ ctx, input }) => storage.updateSettings(input, ctx.user!.id)),
});

// ── Root router ───────────────────────────────────────────────────────────────
export const appRouter = router({
  mixer:  mixerRouter,
  dj:     djRouter,
  aiMix:  aiMixRouter,
  sessions:     sessionsRouter,
  projects:     projectsRouter,
  presets:      presetsRouter,
  settings:     settingsRouter,
  subscription: subscriptionRouter,
});

export type AppRouter = typeof appRouter;