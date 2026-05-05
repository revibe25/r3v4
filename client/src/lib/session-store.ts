/**
 * client/src/lib/session-store.ts
 *
 * IndexedDB persistence for R3 sessions — powered by Dexie (already in deps).
 *
 * DB:    r3v4-sessions  (v1)
 * Table: sessions
 * Key:   'autosave'
 *
 * Replaces the previous raw IDBOpenDBRequest implementation (80 lines of
 * manual promise-wrapping and transaction management) with the Dexie API
 * that's already installed and paid for in the client bundle.
 *
 * No conflict with server/db sessions table — that is Postgres, server-only.
 * This is browser-local IndexedDB.
 *
 * saveSession() is fire-and-forget safe — errors are swallowed so a storage
 * failure never crashes the audio engine.
 */

import Dexie, { type Table } from 'dexie';

interface SessionEntry {
  key:   string;
  value: string;
}

class SessionDatabase extends Dexie {
  sessions!: Table<SessionEntry, string>;

  constructor() {
    super('r3v4-sessions');
    this.version(1).stores({
      sessions: 'key',  // primary key is the 'key' field
    });
  }
}

const db       = new SessionDatabase();
const AUTO_KEY = 'autosave';

export async function saveSession(data: unknown): Promise<void> {
  try {
    await db.sessions.put({ key: AUTO_KEY, value: JSON.stringify(data) });
  } catch {
    // Best-effort — never throw from autosave path
  }
}

export async function loadSession(): Promise<unknown | null> {
  try {
    const entry = await db.sessions.get(AUTO_KEY);
    if (!entry) return null;
    return JSON.parse(entry.value);
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  try {
    await db.sessions.delete(AUTO_KEY);
  } catch {
    // Best-effort
  }
}
