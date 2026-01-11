import { eq, sql, and, inArray, desc } from "drizzle-orm";
import { db } from "./db";
import { 
  users, 
  sessions, 
  projects, 
  samples, 
  presets, 
  settings 
} from "./db/schema";
import { 
  type User, 
  type InsertUser, 
  type Session, 
  type InsertSession,
  type Project,
  type InsertProject,
  type Sample,
  type InsertSample,
  type Preset,
  type InsertPreset,
  type Settings,
  type InsertSettings
} from "@shared/schema";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;

  // Session operations
  getSessions(): Promise<Session[]>;
  getSession(id: string): Promise<Session | undefined>;
  createSession(session: InsertSession): Promise<Session>;
  updateSession(id: string, session: Partial<InsertSession>): Promise<Session | undefined>;
  deleteSession(id: string): Promise<boolean>;

  // Project operations
  getProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, project: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<boolean>;

  // Sample operations
  getSamples(): Promise<Sample[]>;
  getSample(id: string): Promise<Sample | undefined>;
  getSamplesByTags(tags: string[]): Promise<Sample[]>;
  createSample(sample: InsertSample): Promise<Sample>;
  updateSample(id: string, sample: Partial<InsertSample>): Promise<Sample | undefined>;
  deleteSample(id: string): Promise<boolean>;

  // Preset operations
  getPresets(type?: string): Promise<Preset[]>;
  getPreset(id: string): Promise<Preset | undefined>;
  createPreset(preset: InsertPreset): Promise<Preset>;
  updatePreset(id: string, preset: Partial<InsertPreset>): Promise<Preset | undefined>;
  deletePreset(id: string): Promise<boolean>;

  // Settings operations
  getSettings(userId?: string): Promise<Settings>;
  updateSettings(updates: Partial<InsertSettings>, userId?: string): Promise<Settings>;
}

export class DatabaseStorage implements IStorage {
  // ==================== USER OPERATIONS ====================

  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values({
      ...insertUser,
      tier: "free",
    }).returning();
    return result[0];
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    const result = await db.update(users)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }

  // ==================== SESSION OPERATIONS ====================

  async getSessions(): Promise<Session[]> {
    const result = await db.select().from(sessions).orderBy(desc(sessions.createdAt));
    return result.map(this.mapSessionFromDb);
  }

  async getSession(id: string): Promise<Session | undefined> {
    const result = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
    return result[0] ? this.mapSessionFromDb(result[0]) : undefined;
  }

  async createSession(insertSession: InsertSession): Promise<Session> {
    const result = await db.insert(sessions).values({
      ...insertSession,
      fx: insertSession.fx as any,
      recordedEvents: insertSession.recordedEvents as any,
    }).returning();
    return this.mapSessionFromDb(result[0]);
  }

  async updateSession(id: string, updates: Partial<InsertSession>): Promise<Session | undefined> {
    const result = await db.update(sessions)
      .set({
        ...updates,
        ...(updates.fx && { fx: updates.fx as any }),
        ...(updates.recordedEvents && { recordedEvents: updates.recordedEvents as any }),
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, id))
      .returning();
    return result[0] ? this.mapSessionFromDb(result[0]) : undefined;
  }

  async deleteSession(id: string): Promise<boolean> {
    const result = await db.delete(sessions).where(eq(sessions.id, id)).returning();
    return result.length > 0;
  }

  // ==================== PROJECT OPERATIONS ====================

  async getProjects(): Promise<Project[]> {
    const result = await db.select().from(projects).orderBy(desc(projects.updatedAt));
    return result.map(this.mapProjectFromDb);
  }

  async getProject(id: string): Promise<Project | undefined> {
    const result = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    return result[0] ? this.mapProjectFromDb(result[0]) : undefined;
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const result = await db.insert(projects).values({
      ...insertProject,
      projectData: insertProject.projectData as any,
    }).returning();
    return this.mapProjectFromDb(result[0]);
  }

  async updateProject(id: string, updates: Partial<InsertProject>): Promise<Project | undefined> {
    const result = await db.update(projects)
      .set({
        ...updates,
        ...(updates.projectData && { projectData: updates.projectData as any }),
        updatedAt: new Date(),
      })
      .where(eq(projects.id, id))
      .returning();
    return result[0] ? this.mapProjectFromDb(result[0]) : undefined;
  }

  async deleteProject(id: string): Promise<boolean> {
    const result = await db.delete(projects).where(eq(projects.id, id)).returning();
    return result.length > 0;
  }

  // ==================== SAMPLE OPERATIONS ====================

  async getSamples(): Promise<Sample[]> {
    const result = await db.select().from(samples).orderBy(desc(samples.createdAt));
    return result.map(this.mapSampleFromDb);
  }

  async getSample(id: string): Promise<Sample | undefined> {
    const result = await db.select().from(samples).where(eq(samples.id, id)).limit(1);
    return result[0] ? this.mapSampleFromDb(result[0]) : undefined;
  }

  async getSamplesByTags(searchTags: string[]): Promise<Sample[]> {
    const result = await db.select().from(samples);
    return result
      .filter((sample) => {
        const sampleTags = sample.tags as string[] || [];
        return searchTags.some((tag) => sampleTags.includes(tag));
      })
      .map(this.mapSampleFromDb);
  }

  async createSample(insertSample: InsertSample): Promise<Sample> {
    const result = await db.insert(samples).values({
      ...insertSample,
      tags: insertSample.tags as any,
      waveformData: insertSample.waveformData as any,
    }).returning();
    return this.mapSampleFromDb(result[0]);
  }

  async updateSample(id: string, updates: Partial<InsertSample>): Promise<Sample | undefined> {
    const result = await db.update(samples)
      .set({
        ...updates,
        ...(updates.tags && { tags: updates.tags as any }),
        ...(updates.waveformData && { waveformData: updates.waveformData as any }),
        updatedAt: new Date(),
      })
      .where(eq(samples.id, id))
      .returning();
    return result[0] ? this.mapSampleFromDb(result[0]) : undefined;
  }

  async deleteSample(id: string): Promise<boolean> {
    const result = await db.delete(samples).where(eq(samples.id, id)).returning();
    return result.length > 0;
  }

  // ==================== PRESET OPERATIONS ====================

  async getPresets(type?: string): Promise<Preset[]> {
    let query = db.select().from(presets);

    if (type) {
      const result = await query.where(eq(presets.type, type)).orderBy(desc(presets.updatedAt));
      return result.map(this.mapPresetFromDb);
    }

    const result = await query.orderBy(desc(presets.updatedAt));
    return result.map(this.mapPresetFromDb);
  }

  async getPreset(id: string): Promise<Preset | undefined> {
    const result = await db.select().from(presets).where(eq(presets.id, id)).limit(1);
    return result[0] ? this.mapPresetFromDb(result[0]) : undefined;
  }

  async createPreset(insertPreset: InsertPreset): Promise<Preset> {
    const result = await db.insert(presets).values({
      ...insertPreset,
      presetData: insertPreset.presetData as any,
      tags: insertPreset.tags as any,
    }).returning();
    return this.mapPresetFromDb(result[0]);
  }

  async updatePreset(id: string, updates: Partial<InsertPreset>): Promise<Preset | undefined> {
    const result = await db.update(presets)
      .set({
        ...updates,
        ...(updates.presetData && { presetData: updates.presetData as any }),
        ...(updates.tags && { tags: updates.tags as any }),
        updatedAt: new Date(),
      })
      .where(eq(presets.id, id))
      .returning();
    return result[0] ? this.mapPresetFromDb(result[0]) : undefined;
  }

  async deletePreset(id: string): Promise<boolean> {
    const result = await db.delete(presets).where(eq(presets.id, id)).returning();
    return result.length > 0;
  }

  // ==================== SETTINGS OPERATIONS ====================

  async getSettings(userId?: string): Promise<Settings> {
    let result;

    if (userId) {
      result = await db.select().from(settings).where(eq(settings.userId, userId)).limit(1);
    } else {
      result = await db.select().from(settings).limit(1);
    }

    // Return default settings if none exist
    if (result.length === 0) {
      const defaultSettings: Settings = {
        id: "default",
        userId: userId,
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
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Create default settings in database
      const created = await db.insert(settings).values({
        userId: userId || null,
        ...defaultSettings,
      }).returning();

      return this.mapSettingsFromDb(created[0]);
    }

    return this.mapSettingsFromDb(result[0]);
  }

  async updateSettings(updates: Partial<InsertSettings>, userId?: string): Promise<Settings> {
    // First try to find existing settings
    let existing;

    if (userId) {
      existing = await db.select().from(settings).where(eq(settings.userId, userId)).limit(1);
    } else {
      existing = await db.select().from(settings).limit(1);
    }

    let result;

    if (existing.length === 0) {
      // Create new settings
      result = await db.insert(settings).values({
        userId: userId || null,
        ...updates,
      }).returning();
    } else {
      // Update existing settings
      result = await db.update(settings)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(settings.id, existing[0].id))
        .returning();
    }

    return this.mapSettingsFromDb(result[0]);
  }

  // ==================== HELPER METHODS ====================

  private mapSessionFromDb(dbSession: any): Session {
    return {
      ...dbSession,
      fx: dbSession.fx as any,
      recordedEvents: dbSession.recordedEvents as any,
    };
  }

  private mapProjectFromDb(dbProject: any): Project {
    return {
      ...dbProject,
      projectData: dbProject.projectData as any,
    };
  }

  private mapSampleFromDb(dbSample: any): Sample {
    return {
      ...dbSample,
      tags: dbSample.tags as string[],
      waveformData: dbSample.waveformData as number[] | undefined,
    };
  }

  private mapPresetFromDb(dbPreset: any): Preset {
    return {
      ...dbPreset,
      presetData: dbPreset.presetData as any,
      tags: dbPreset.tags as string[],
    };
  }

  private mapSettingsFromDb(dbSettings: any): Settings {
    return {
      ...dbSettings,
    };
  }
}

// Export singleton instance using database
export const storage = new DatabaseStorage();