/**
 * server/services/arrangement.service.ts
 * Drizzle-backed CRUD for arrangements.
 * Falls back to the in-memory store if the DB is unavailable.
 */
import { nanoid }    from "nanoid";
import { eq, and }   from "drizzle-orm";
import type { Arrangement } from "../../shared/arrangement.types";
import { DEFAULT_ARRANGEMENT } from "../../shared/arrangement.types";

// ── Try to import the DB — if schema is not migrated yet, fall back silently ─
let db: import("drizzle-orm/node-postgres").NodePgDatabase | null = null;
let arrangements: typeof import("../../db/schema/arrangements").arrangements | null = null;

async function getDB() {
  if (db && arrangements) return { db, arrangements };
  try {
    const { drizzle }  = await import("drizzle-orm/node-postgres");
    const { Pool }     = await import("pg");
    const { arrangements: tbl } = await import("../../db/schema/arrangements");
    const pool = new Pool({ connectionString: process.env["DATABASE_URL"] });
    db = drizzle(pool);
    arrangements = tbl;
    return { db, arrangements };
  } catch {
    return null;
  }
}

// ── In-memory fallback ────────────────────────────────────────────────────────
const memStore = new Map<string, Arrangement>();

function toArrangement(row: Record<string, unknown>): Arrangement {
  return {
    id:            row["id"] as string,
    name:          row["name"] as string,
    tempo:         row["tempo"] as number,
    timeSignature: {
      numerator:   row["time_signature_n"] as number,
      denominator: row["time_signature_d"] as number,
    },
    lengthBars:    row["length_bars"] as number,
    loopRange:     row["loop_range"] as Arrangement["loopRange"],
    tracks:        (row["tracks"] as Arrangement["tracks"]) ?? [],
    markers:       (row["markers"] as Arrangement["markers"]) ?? [],
    createdAt:     new Date(row["created_at"] as string),
    updatedAt:     new Date(row["updated_at"] as string),
  };
}

export async function createArrangement(
  userId: string, name?: string,
): Promise<Arrangement> {
  const id = nanoid();
  const now = new Date();
  const base: Arrangement = {
    ...DEFAULT_ARRANGEMENT,
    id,
    name: name ?? "Untitled Project",
    tracks:    [],
    markers:   [],
    loopRange: { startBar: 1, endBar: 5, enabled: false },
    createdAt: now,
    updatedAt: now,
  };

  const ctx = await getDB();
  if (ctx) {
    try {
      await ctx.db.insert(ctx.arrangements).values({
        id,
        userId,
        name: base.name,
        tempo: base.tempo,
        timeSignatureN: base.timeSignature.numerator,
        timeSignatureD: base.timeSignature.denominator,
        lengthBars: base.lengthBars,
        loopRange:  base.loopRange as any,
        tracks:     base.tracks   as any,
        markers:    base.markers  as any,
      });
      return base;
    } catch (err) {
      console.warn("[arrangement.service] DB insert failed, using memory:", err);
    }
  }
  memStore.set(id, base);
  return base;
}

export async function getArrangement(id: string): Promise<Arrangement | null> {
  const ctx = await getDB();
  if (ctx) {
    try {
      const rows = await ctx.db
        .select()
        .from(ctx.arrangements)
        .where(eq(ctx.arrangements.id, id))
        .limit(1);
      if (rows.length) return toArrangement(rows[0] as any);
    } catch {}
  }
  return memStore.get(id) ?? null;
}

export async function listArrangements(userId: string): Promise<Arrangement[]> {
  const ctx = await getDB();
  if (ctx) {
    try {
      const rows = await ctx.db
        .select()
        .from(ctx.arrangements)
        .where(eq(ctx.arrangements.userId, userId));
      return rows.map(r => toArrangement(r as any));
    } catch {}
  }
  return [...memStore.values()];
}

export async function updateArrangement(
  id: string,
  patch: Partial<Omit<Arrangement, "id" | "createdAt">>,
): Promise<Arrangement | null> {
  const existing = await getArrangement(id);
  if (!existing) return null;

  const updated: Arrangement = { ...existing, ...patch, updatedAt: new Date() };

  const ctx = await getDB();
  if (ctx) {
    try {
      await ctx.db
        .update(ctx.arrangements)
        .set({
          name:          updated.name,
          tempo:         updated.tempo,
          timeSignatureN: updated.timeSignature.numerator,
          timeSignatureD: updated.timeSignature.denominator,
          lengthBars:    updated.lengthBars,
          loopRange:     updated.loopRange  as any,
          tracks:        updated.tracks     as any,
          markers:       updated.markers    as any,
          updatedAt:     updated.updatedAt,
        })
        .where(eq(ctx.arrangements.id, id));
      return updated;
    } catch {}
  }
  memStore.set(id, updated);
  return updated;
}

export async function deleteArrangement(id: string): Promise<boolean> {
  const ctx = await getDB();
  if (ctx) {
    try {
      await ctx.db.delete(ctx.arrangements).where(eq(ctx.arrangements.id, id));
      return true;
    } catch {}
  }
  return memStore.delete(id);
}
