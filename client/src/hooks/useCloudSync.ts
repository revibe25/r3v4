/**
 * useCloudSync.ts
 *
 * Reusable project persistence API for the live DAW.
 *
 * Responsibilities:
 *   - canonical project save
 *   - canonical project load
 *   - project listing
 *   - local snapshot recovery
 *
 * Intentionally does NOT start its own autosave timer.
 * DAW.tsx owns the active autosave schedule and calls the same canonical
 * serializer directly, preventing duplicate persistence loops.
 */

import { useCallback } from 'react';
import { useDAWStore } from './useDAWStore';
import { useAuthStore } from './authStore';
import {
  trpcVanilla,
  isTRPCForbidden,
  isTRPCUnauthorized,
} from '../lib/trpc';
import {
  serializeDAWProjectState,
  type PersistedDAWProjectState,
} from '../project/daw-project-state';

const LOCAL_SNAPSHOT_KEY_PREFIX = 'r3v4_project_snapshot:';

interface LocalSnapshot {
  schemaVersion: 1;
  userId: string;
  projectName: string;
  savedAt: number;
  state: PersistedDAWProjectState;
}

function hasValidToken(): boolean {
  const token = useAuthStore.getState().token;
  return typeof token === 'string'
    && token.trim().length > 0
    && token.split('.').length === 3;
}

function saveLocalSnapshot(
  state: PersistedDAWProjectState,
  projectName: string,
): number | null {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return null;

  const savedAt = Date.now();

  const snapshot: LocalSnapshot = {
    schemaVersion: 1,
    userId,
    projectName,
    savedAt,
    state,
  };

  localStorage.setItem(
    `${LOCAL_SNAPSHOT_KEY_PREFIX}${userId}`,
    JSON.stringify(snapshot),
  );

  return savedAt;
}

function isPersistedDAWProjectState(
  value: unknown,
): value is PersistedDAWProjectState {
  if (!value || typeof value !== 'object') return false;

  const state = value as Record<string, unknown>;

  return (
    typeof state.bpm === 'number' &&
    Array.isArray(state.timeSignature) &&
    state.timeSignature.length === 2 &&
    state.timeSignature.every(
      value => typeof value === 'number' && Number.isInteger(value),
    ) &&
    typeof state.masterGain === 'number' &&
    Array.isArray(state.tracks) &&
    Array.isArray(state.regions) &&
    Array.isArray(state.midiPatterns) &&
    typeof state.loopEnabled === 'boolean' &&
    typeof state.loopStart === 'number' &&
    typeof state.loopEnd === 'number'
  );
}

function readLocalSnapshot(): LocalSnapshot | null {
  try {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return null;

    const raw = localStorage.getItem(
      `${LOCAL_SNAPSHOT_KEY_PREFIX}${userId}`,
    );
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<LocalSnapshot>;

    if (
      parsed.schemaVersion !== 1 ||
      parsed.userId !== userId ||
      typeof parsed.projectName !== 'string' ||
      typeof parsed.savedAt !== 'number' ||
      !isPersistedDAWProjectState(parsed.state)
    ) {
      return null;
    }

    return parsed as LocalSnapshot;
  } catch {
    return null;
  }
}

function markLoadError(error: unknown): never {
  const store = useDAWStore.getState();
  store.setSyncStatus('error');

  if (isTRPCUnauthorized(error)) {
    throw new Error('Authentication expired. Please sign in again.');
  }

  if (isTRPCForbidden(error)) {
    throw new Error('Your subscription tier does not allow this project operation.');
  }

  throw new Error('Failed to load project.');
}

export interface CloudSyncAPI {
  save: () => Promise<void>;
  load: (projectId: string) => Promise<void>;
  listProjects: () => Promise<
    { id: string; name: string; updatedAt: Date; createdAt: Date }[]
  >;
  restoreLocalSnapshot: () => boolean;
}

export function useCloudSync(): CloudSyncAPI {
  const save = useCallback(async () => {
    const store = useDAWStore.getState();

    let savedAt: number;
    let state: PersistedDAWProjectState;

    try {
      state = serializeDAWProjectState();
      savedAt = saveLocalSnapshot(state, store.projectName) ?? Date.now();
      store.setLastSaved(savedAt);
    } catch {
      store.setSyncStatus('error');
      throw new Error('Failed to save the local project snapshot.');
    }

    if (!hasValidToken()) {
      store.setSyncStatus('idle');
      return;
    }

    store.setSyncStatus('syncing');

    try {
      const result = await trpcVanilla.daw['project.save'].mutate({
        projectId: store.projectId ?? undefined,
        name: store.projectName,
        state,
      });

      const current = useDAWStore.getState();
      current.setProjectId(result.projectId);      const savedAtMs = Date.parse(result.savedAt);
      current.setLastSaved(Number.isFinite(savedAtMs) ? savedAtMs : Date.now());
      current.setSyncStatus('synced');
    } catch (error) {
      useDAWStore.getState().setSyncStatus('error');
      throw error;
    }
  }, []);

  const load = useCallback(async (projectId: string) => {
    if (!hasValidToken()) {
      throw new Error('Not authenticated');
    }

    const store = useDAWStore.getState();
    store.setSyncStatus('syncing');

    try {
      const result = await trpcVanilla.daw['project.load'].query({
        projectId,
      });

      store.hydrateProject(result.state);
      store.setProjectId(result.projectId);
      store.setProjectName(result.name);
      const updatedAtMs = Date.parse(result.updatedAt);

      store.setLastSaved(Number.isFinite(updatedAtMs) ? updatedAtMs : Date.now());
      store.setSyncStatus('synced');
    } catch (error) {
      markLoadError(error);
    }
  }, []);

  const listProjects = useCallback(async () => {
    if (!hasValidToken()) {
      throw new Error('Not authenticated');
    }

    const projects = await trpcVanilla.daw['project.list'].query();
    return projects.map(project => ({
      ...project,
      updatedAt: new Date(project.updatedAt),
      createdAt: new Date(project.createdAt),
    }));
  }, []);

  const restoreLocalSnapshot = useCallback((): boolean => {
    const snapshot = readLocalSnapshot();
    if (!snapshot) return false;

    const store = useDAWStore.getState();

    store.hydrateProject(snapshot.state);
    store.setProjectName(snapshot.projectName);
    store.setProjectId(null);
    store.setLastSaved(snapshot.savedAt);
    store.setSyncStatus('idle');

    return true;
  }, []);

  return {
    save,
    load,
    listProjects,
    restoreLocalSnapshot,
  };
}
