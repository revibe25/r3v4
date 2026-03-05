import { z } from 'zod';
import { router, publicProc } from '../trpc';
import { storage } from '../storage';
import {
  insertSessionSchema,
  insertProjectSchema,
  insertPresetSchema,
} from '../db/schema';

// ── Sessions ─────────────────────────────────────────────────────────────────
const sessionsRouter = router({
  list: publicProc
    .query(() => storage.getSessions()),

  byId: publicProc
    .input(z.object({ id: z.string() }))
    .query(({ input }) => storage.getSession(input.id)),

  create: publicProc
    .input(insertSessionSchema)
    .mutation(({ input }) => storage.createSession(input as any)),

  update: publicProc
    .input(z.object({ id: z.string(), data: z.record(z.unknown()) }))
    .mutation(({ input }) => storage.updateSession(input.id, input.data)),

  delete: publicProc
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => storage.deleteSession(input.id)),
});

// ── Projects ──────────────────────────────────────────────────────────────────
const projectsRouter = router({
  list: publicProc
    .query(() => storage.getProjects()),

  byId: publicProc
    .input(z.object({ id: z.string() }))
    .query(({ input }) => storage.getProject(input.id)),

  create: publicProc
    .input(insertProjectSchema)
    .mutation(({ input }) => storage.createProject(input as any)),

  update: publicProc
    .input(z.object({ id: z.string(), data: z.record(z.unknown()) }))
    .mutation(({ input }) => storage.updateProject(input.id, input.data)),

  delete: publicProc
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => storage.deleteProject(input.id)),
});

// ── Presets ───────────────────────────────────────────────────────────────────
const presetsRouter = router({
  list: publicProc
    .input(z.object({ type: z.string().optional() }))
    .query(({ input }) => storage.getPresets(input.type)),

  byId: publicProc
    .input(z.object({ id: z.string() }))
    .query(({ input }) => storage.getPreset(input.id)),

  create: publicProc
    .input(insertPresetSchema)
    .mutation(({ input }) => storage.createPreset(input as any)),

  update: publicProc
    .input(z.object({ id: z.string(), data: z.record(z.unknown()) }))
    .mutation(({ input }) => storage.updatePreset(input.id, input.data)),

  delete: publicProc
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => storage.deletePreset(input.id)),
});

// ── Settings ──────────────────────────────────────────────────────────────────
const settingsRouter = router({
  get: publicProc
    .query(() => storage.getSettings()),

  update: publicProc
    .input(z.record(z.unknown()))
    .mutation(({ input }) => storage.updateSettings(input)),
});

// ── Root router — this is the shape the client imports ────────────────────────
export const appRouter = router({
  sessions: sessionsRouter,
  projects: projectsRouter,
  presets:  presetsRouter,
  settings: settingsRouter,
});

// Export the type — client imports this, never the implementation
export type AppRouter = typeof appRouter;
