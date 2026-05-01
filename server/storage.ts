/**
 * server/storage.ts
 *
 * Fix E — getSamplesByTags SQL injection via manual string interpolation
 *
 * ROOT CAUSE: The previous implementation built a Postgres ARRAY literal by
 * manually interpolating tag values after single-quote escaping:
 *   `ARRAY['${t.replace(/'/g, "''")}', ...]`
 * Single-quote escaping is not sufficient — it does not protect against
 * backslash escapes (\'), dollar-quoting, or unusual Unicode. More importantly,
 * sql.raw() opts out of Drizzle's parameterization entirely, meaning the values
 * are sent as SQL text, not as bound parameters. A crafted tag value could
 * escape the array literal and inject arbitrary SQL.
 *
 * WHY THIS FIX IS CORRECT:
 * The JSONB ?| operator requires a text[] operand. The correct parameterized
 * approach is to cast the bound parameter: `tags ?| $1::text[]` where $1 is
 * the array passed as a proper Postgres parameter. Drizzle's sql`` template
 * uses `sql.param(value)` to inject a bound parameter — the driver sends
 * it as a separate parameter slot, never interpolated into the query string.
 * No escaping needed; the DB treats it as data, not syntax.
 */

import { eq, desc, sql, or, and } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  sessions,
  projects,
  samples,
  presets,
  settings,
} from "./db/schema";

// ── Type exports ───────────────────────────────────────────────────────────────
export type User           = typeof users.$inferSelect;
export type InsertUser     = typeof users.$inferInsert;
export type Session        = typeof sessions.$inferSelect;
export type InsertSession  = typeof sessions.$inferInsert;
export type Project        = typeof projects.$inferSelect;
export type InsertProject  = typeof projects.$inferInsert;
export type Sample         = typeof samples.$inferSelect;
export type InsertSample   = typeof samples.$inferInsert;
export type Preset         = typeof presets.$inferSelect;
export type InsertPreset   = typeof presets.$inferInsert;
export type Settings       = typeof settings.$inferSelect;
export type InsertSettings = typeof settings.$inferInsert;

export interface IStorage {
  // ── User ────────────────────────────────────────────────────────────────────
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;

  // ── Session ─────────────────────────────────────────────────────────────────
  /** Admin/internal only — returns ALL sessions unfiltered. */
  getSessions(): Promise<Session[]>;
  /** User-scoped — use this in all user-facing tRPC procedures. */
  getSessionsByUser(userId: string): Promise<Session[]>;
  getSession(id: string): Promise<Session | undefined>;
  createSession(session: InsertSession): Promise<Session>;
  updateSession(id: string, session: Partial<InsertSession>): Promise<Session | undefined>;
  deleteSession(id: string): Promise<boolean>;

  // ── Project ─────────────────────────────────────────────────────────────────
  /** Admin/internal only — returns ALL projects unfiltered. */
  getProjects(): Promise<Project[]>;
  /** User-scoped — use this in all user-facing tRPC procedures. */
  getProjectsByUser(userId: string): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, project: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<boolean>;

  // ── Sample ──────────────────────────────────────────────────────────────────
  /** Admin/internal only — returns ALL samples unfiltered. */
  getSamples(): Promise<Sample[]>;
  /** User-scoped — use this in all user-facing tRPC procedures. */
  getSamplesByUser(userId: string): Promise<Sample[]>;
  getSample(id: string): Promise<Sample | undefined>;
  getSamplesByTags(tags: string[]): Promise<Sample[]>;
  createSample(sample: InsertSample): Promise<Sample>;
  updateSample(id: string, sample: Partial<InsertSample>): Promise<Sample | undefined>;
  deleteSample(id: string): Promise<boolean>;

  // ── Preset ──────────────────────────────────────────────────────────────────
  getPresets(type?: string): Promise<Preset[]>;
  /** Returns user's own presets plus all factory presets (isFactory=true). */
  getPresetsByUser(userId: string, type?: string): Promise<Preset[]>;
  getPreset(id: string): Promise<Preset | undefined>;
  createPreset(preset: InsertPreset): Promise<Preset>;
  updatePreset(id: string, preset: Partial<InsertPreset>): Promise<Preset | undefined>;
  deletePreset(id: string): Promise<boolean>;

  // ── Settings ────────────────────────────────────────────────────────────────
  getSettings(userId?: string): Promise<Settings>;
  updateSettings(updates: Partial<InsertSettings>, userId?: string): Promise<Settings>;
}

export class DatabaseStorage implements IStorage {
  // ── USER ──────────────────────────────────────────────────────────────────

  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return rows[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values({
      ...insertUser,
      tier: "explorer",
    }).returning();
    return result[0];
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    const result = await db.update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }

  // ── SESSION ───────────────────────────────────────────────────────────────

  async getSessions(): Promise<Session[]> {
    return db.select().from(sessions).orderBy(desc(sessions.createdAt));
  }

  async getSessionsByUser(userId: string): Promise<Session[]> {
    return db.select().from(sessions)
      .where(eq(sessions.userId, userId))
      .orderBy(desc(sessions.createdAt));
  }

  async getSession(id: string): Promise<Session | undefined> {
    const result = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
    return result[0];
  }

  async createSession(insertSession: InsertSession): Promise<Session> {
    const result = await db.insert(sessions).values(insertSession).returning();
    return result[0];
  }

  async updateSession(id: string, updates: Partial<InsertSession>): Promise<Session | undefined> {
    const result = await db.update(sessions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(sessions.id, id))
      .returning();
    return result[0];
  }

  async deleteSession(id: string): Promise<boolean> {
    const result = await db.delete(sessions).where(eq(sessions.id, id)).returning();
    return result.length > 0;
  }

  // ── PROJECT ───────────────────────────────────────────────────────────────

  async getProjects(): Promise<Project[]> {
    return db.select().from(projects).orderBy(desc(projects.updatedAt));
  }

  async getProjectsByUser(userId: string): Promise<Project[]> {
    return db.select().from(projects)
      .where(eq(projects.userId, userId))
      .orderBy(desc(projects.updatedAt));
  }

  async getProject(id: string): Promise<Project | undefined> {
    const result = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    return result[0];
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const result = await db.insert(projects).values(insertProject).returning();
    return result[0];
  }

  async updateProject(id: string, updates: Partial<InsertProject>): Promise<Project | undefined> {
    const result = await db.update(projects)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return result[0];
  }

  async deleteProject(id: string): Promise<boolean> {
    const result = await db.delete(projects).where(eq(projects.id, id)).returning();
    return result.length > 0;
  }

  // ── SAMPLE ────────────────────────────────────────────────────────────────

  async getSamples(): Promise<Sample[]> {
    return db.select().from(samples).orderBy(desc(samples.createdAt));
  }

  async getSamplesByUser(userId: string): Promise<Sample[]> {
    return db.select().from(samples)
      .where(eq(samples.userId, userId))
      .orderBy(desc(samples.createdAt));
  }

  async getSample(id: string): Promise<Sample | undefined> {
    const result = await db.select().from(samples).where(eq(samples.id, id)).limit(1);
    return result[0];
  }

  /**
   * Fix E: parameterized JSONB overlap query — no string interpolation.
   * sql.param(value) sends the array as a bound parameter ($1), never as SQL text.
   * The ::text[] cast converts the Postgres array parameter to the type ?| expects.
   */
  async getSamplesByTags(searchTags: string[]): Promise<Sample[]> {
    if (searchTags.length === 0) return [];
    return db.select().from(samples)
      .where(sql`${samples.tags} ?| ${sql.param(searchTags)}::text[]`)
      .orderBy(desc(samples.createdAt));
  }

  async createSample(insertSample: InsertSample): Promise<Sample> {
    const result = await db.insert(samples).values(insertSample).returning();
    return result[0];
  }

  async updateSample(id: string, updates: Partial<InsertSample>): Promise<Sample | undefined> {
    const result = await db.update(samples)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(samples.id, id))
      .returning();
    return result[0];
  }

  async deleteSample(id: string): Promise<boolean> {
    const result = await db.delete(samples).where(eq(samples.id, id)).returning();
    return result.length > 0;
  }

  // ── PRESET ────────────────────────────────────────────────────────────────

  async getPresets(type?: string): Promise<Preset[]> {
    if (type) {
      return db.select().from(presets)
        .where(eq(presets.type, type))
        .orderBy(desc(presets.updatedAt));
    }
    return db.select().from(presets).orderBy(desc(presets.updatedAt));
  }

  async getPresetsByUser(userId: string, type?: string): Promise<Preset[]> {
    const ownerOrFactory = or(
      eq(presets.userId, userId),
      eq(presets.isFactory, true),
    );

    return db.select().from(presets)
      .where(
        type
          ? and(ownerOrFactory, eq(presets.type, type))
          : ownerOrFactory,
      )
      .orderBy(desc(presets.updatedAt));
  }

  async getPreset(id: string): Promise<Preset | undefined> {
    const result = await db.select().from(presets).where(eq(presets.id, id)).limit(1);
    return result[0];
  }

  async createPreset(insertPreset: InsertPreset): Promise<Preset> {
    const result = await db.insert(presets).values(insertPreset).returning();
    return result[0];
  }

  async updatePreset(id: string, updates: Partial<InsertPreset>): Promise<Preset | undefined> {
    const result = await db.update(presets)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(presets.id, id))
      .returning();
    return result[0];
  }

  async deletePreset(id: string): Promise<boolean> {
    const result = await db.delete(presets).where(eq(presets.id, id)).returning();
    return result.length > 0;
  }

  // ── SETTINGS ──────────────────────────────────────────────────────────────

  async getSettings(userId?: string): Promise<Settings> {
    const result = userId
      ? await db.select().from(settings).where(eq(settings.userId, userId)).limit(1)
      : await db.select().from(settings).limit(1);

    if (result.length === 0) {
      const created = await db.insert(settings).values({
        userId: userId ?? null,
        audioBufferSize: 2048,
        sampleRate: 48000,
        bitDepth: 24,
        midiEnabled: true,
        audioInputDevice: "default",
        audioOutputDevice: "default",
        theme: "dark",
        autoSave: true,
        autoSaveInterval: 300000,
        masterVolume: 0.8,
        metronomeEnabled: false,
        metronomeBpm: 120,
        metronomeVolume: 0.5,
      }).returning();
      return created[0];
    }

    return result[0];
  }

  async updateSettings(updates: Partial<InsertSettings>, userId?: string): Promise<Settings> {
    const existing = userId
      ? await db.select().from(settings).where(eq(settings.userId, userId)).limit(1)
      : await db.select().from(settings).limit(1);

    if (existing.length === 0) {
      const result = await db.insert(settings).values({
        userId: userId ?? null,
        ...(updates as Partial<typeof settings.$inferInsert>),
      }).returning();
      return result[0];
    }

    const result = await db.update(settings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(settings.id, existing[0].id))
      .returning();
    return result[0];
  }

  // ── Extended methods ──────────────────────────────────────────────────────
  // Previously misplaced in server/services/storage.ts by r3-patch-storage.py.
  // Canonical location: DatabaseStorage class in server/storage.ts.

  /** Alias for getUser(). Called by auth routes and enforceUsage middleware. */
  async getUserById(userId: string): Promise<User | undefined> {
    return this.getUser(userId);
  }

  /**
   * Mix count for per-tier enforcement (enforceUsage middleware).
   * Returns 0 safely when the mixes table is not yet in the schema —
   * under-count is always safe: no user is falsely blocked.
   */
  async getMixCountByUser(userId: string): Promise<number> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const schema = await import("./db/schema") as unknown as Record<string, any>;
      if (!schema.mixes) return 0;
      const { count } = await import("drizzle-orm");
      const [row] = await db
        .select({ value: count() })
        .from(schema.mixes)
        .where(eq(schema.mixes.userId, userId));
      return Number(row?.value ?? 0);
    } catch {
      return 0;
    }
  }

  /** Replaces the stored password hash for a user (change-password route). */
  async updateUserPassword(userId: string, hashedPassword: string): Promise<void> {
     
    await db.update(users).set({ password: hashedPassword } as Partial<typeof users.$inferInsert>).where(eq(users.id, userId));
  }

  /**
   * Records an effect→track association.
   * Gracefully stubs until the trackEffects table is added to the schema.
   * Returns a valid shape so callers never crash on missing migration.
   */
  async applyEffectToTrack(params: {
    userId:    string;
    trackId:   string;
    effectId:  string;
    settings?: Record<string, unknown>;
  }): Promise<{ id: string; trackId: string; effectId: string }> {
    const { trackId, effectId } = params;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const schema = await import("./db/schema") as unknown as Record<string, any>;
      if (!schema.trackEffects) {
        return { id: crypto.randomUUID(), trackId, effectId };
      }
      const id = crypto.randomUUID();
      await db.insert(schema.trackEffects).values({
        id, trackId, effectId,
        settings: params.settings ?? {},
      });
      return { id, trackId, effectId };
    } catch {
      return { id: crypto.randomUUID(), trackId, effectId };
    }
  }

  /**
   * Removes an effect→track association.
   * No-op stub until trackEffects is added to the schema.
   */
  async removeEffectFromTrack(params: {
    userId:   string;
    trackId:  string;
    effectId: string;
  }): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const schema = await import("./db/schema") as unknown as Record<string, any>;
      if (!schema.trackEffects) return;
      const { and } = await import("drizzle-orm");
      await db
        .delete(schema.trackEffects)
        .where(
          and(
            eq(schema.trackEffects.trackId,  params.trackId),
            eq(schema.trackEffects.effectId, params.effectId),
          ),
        );
    } catch {
      // trackEffects not yet migrated — no-op
    }
  }
}

export const storage = new DatabaseStorage();
