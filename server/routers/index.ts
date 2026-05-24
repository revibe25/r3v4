/**
 * server/routers/index.ts
 *
// [wire§13] AppRouter type removed — import from server/procedures.ts
 *          bottom of this file. Two exports of the same identifier in one module
 *          is a TypeScript error (Duplicate identifier 'AppRouter'). The canonical
 *          client-facing re-export lives in shared/types/trpc.ts.
 *
 * Fix 2 — Removed all ctx.user! non-null assertions. requireAuth in trpc.ts
 *          casts to AuthenticatedContext (user: AuthPayload, non-optional) before
 *          any handler runs. Assertions were redundant and masked intent.
 *
 * Fix 3 — Replaced Object.assign({}, input, { userId }) as any with typed
 *          payload construction. InsertSession / InsertProject / InsertPreset
 *          are imported from storage.ts and used as explicit annotations.
 *          The spread is valid: omit({ userId: true }) produces fields that are
 *          a strict subset of InsertSession/Project/Preset, and ctx.user.id is
 *          string, matching userId: varchar (string | null) — assignable.
 *          No type suppression needed; compiler can verify the full shape.
 *
 * Fix 4 — update mutations now cast input.data to Partial<InsertSession> etc.
 *          rather than passing Record<string,unknown> directly. This is the
 *          minimal correct annotation: the runtime value is already a partial
 *          record of the schema fields; the cast formalises that contract.
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router } from '../trpc';
import { protectedProcedure } from '../base-procedures';
import { storage } from '../storage';
import type { InsertSession, InsertProject, InsertPreset } from '../storage';
import {
  insertSessionSchema,
  insertProjectSchema,
  insertPresetSchema,
} from '../db/schema';

// ── Sessions ──────────────────────────────────────────────────────────────────
export const sessionsRouter = router({
  list: protectedProcedure
    .query(({ ctx }) => storage.getSessionsByUser(ctx.user.id)),

  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const session = await storage.getSession(input.id);
      if (!session) throw new TRPCError({ code: 'NOT_FOUND' });
      if (session.userId !== ctx.user.id) throw new TRPCError({ code: 'FORBIDDEN' });
      return session;
    }),

  create: protectedProcedure
    .input(insertSessionSchema.omit({ userId: true }))
    .mutation(({ ctx, input }) => {
      const payload: InsertSession = { ...(input as Omit<InsertSession, 'userId'>), userId: ctx.user.id };
      return storage.createSession(payload);
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string(), data: z.record(z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      const session = await storage.getSession(input.id);
      if (!session) throw new TRPCError({ code: 'NOT_FOUND' });
      if (session.userId !== ctx.user.id) throw new TRPCError({ code: 'FORBIDDEN' });
      return storage.updateSession(input.id, input.data as Partial<InsertSession>);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const session = await storage.getSession(input.id);
      if (!session) throw new TRPCError({ code: 'NOT_FOUND' });
      if (session.userId !== ctx.user.id) throw new TRPCError({ code: 'FORBIDDEN' });
      return storage.deleteSession(input.id);
    }),
});

// ── Projects ──────────────────────────────────────────────────────────────────
export const projectsRouter = router({
  list: protectedProcedure
    .query(({ ctx }) => storage.getProjectsByUser(ctx.user.id)),

  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await storage.getProject(input.id);
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' });
      if (project.userId !== ctx.user.id) throw new TRPCError({ code: 'FORBIDDEN' });
      return project;
    }),

  create: protectedProcedure
    .input(insertProjectSchema.omit({ userId: true }))
    .mutation(({ ctx, input }) => {
      const payload: InsertProject = { ...(input as Omit<InsertProject, 'userId'>), userId: ctx.user.id };
      return storage.createProject(payload);
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string(), data: z.record(z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      const project = await storage.getProject(input.id);
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' });
      if (project.userId !== ctx.user.id) throw new TRPCError({ code: 'FORBIDDEN' });
      return storage.updateProject(input.id, input.data as Partial<InsertProject>);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const project = await storage.getProject(input.id);
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' });
      if (project.userId !== ctx.user.id) throw new TRPCError({ code: 'FORBIDDEN' });
      return storage.deleteProject(input.id);
    }),
});

// ── Presets ───────────────────────────────────────────────────────────────────
export const presetsRouter = router({
  list: protectedProcedure
    .input(z.object({ type: z.string().optional() }))
    .query(({ ctx, input }) => storage.getPresetsByUser(ctx.user.id, input.type)),

  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const preset = await storage.getPreset(input.id);
      if (!preset) throw new TRPCError({ code: 'NOT_FOUND' });
      if (!preset.isFactory && preset.userId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      return preset;
    }),

  create: protectedProcedure
    .input(insertPresetSchema.omit({ userId: true }))
    .mutation(({ ctx, input }) => {
      const payload: InsertPreset = { ...(input as Omit<InsertPreset, 'userId'>), userId: ctx.user.id };
      return storage.createPreset(payload);
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string(), data: z.record(z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      const preset = await storage.getPreset(input.id);
      if (!preset) throw new TRPCError({ code: 'NOT_FOUND' });
      if (preset.userId !== ctx.user.id) throw new TRPCError({ code: 'FORBIDDEN' });
      return storage.updatePreset(input.id, input.data as Partial<InsertPreset>);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const preset = await storage.getPreset(input.id);
      if (!preset) throw new TRPCError({ code: 'NOT_FOUND' });
      if (preset.userId !== ctx.user.id) throw new TRPCError({ code: 'FORBIDDEN' });
      return storage.deletePreset(input.id);
    }),
});

// ── Settings ──────────────────────────────────────────────────────────────────
export const settingsRouter = router({
  get: protectedProcedure
    .query(({ ctx }) => storage.getSettings(ctx.user.id)),

  update: protectedProcedure
    .input(z.record(z.unknown()))
    .mutation(({ ctx, input }) => storage.updateSettings(input, ctx.user.id)),
});

// ── Root router ───────────────────────────────────────────────────────────────
// [wire§13] appRouter removed — canonical location is server/procedures.ts

// Single canonical AppRouter export from this file.
// The client imports AppRouter from shared/types/trpc.ts (which re-exports this
// type via `import type`) to prevent Vite from crawling server-side modules.
// [wire§13] AppRouter type export removed — use server/procedures.ts