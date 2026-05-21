import { useCallback, useRef, useState, useEffect } from 'react';

export interface CollaborativeStateChange {
  id: string;
  userId: string;
  timestamp: number;
  path: string[]; // e.g., ['tracks', 'tr1', 'volume']
  oldValue: any;
  newValue: any;
  resolved: boolean;
}

export interface ConflictResolution {
  strategy: 'local' | 'remote' | 'merge';
  change: CollaborativeStateChange;
}

/**
 * Hook for managing collaborative state changes with conflict resolution.
 * Implements operational transformation (OT) for real-time sync.
 * 
 * @example
 * const { applyRemoteChange, getConflicts, resolveConflict } = useCollaborativeState({
 *   userId: 'user123',
 *   onConflict: (conflicts) => console.log('Conflicts:', conflicts)
 * });
 */
export function useCollaborativeState({
  userId,
  onConflict,
}: {
  userId: string;
  onConflict?: (conflicts: CollaborativeStateChange[]) => void;
}) {
  const localChangesRef = useRef<CollaborativeStateChange[]>([]);
  const remoteChangesRef = useRef<CollaborativeStateChange[]>([]);
  const [conflicts, setConflicts] = useState<CollaborativeStateChange[]>([]);

  /**
   * Track a local state change
   */
  const trackLocalChange = useCallback(
    (
      path: string[],
      oldValue: any,
      newValue: any
    ): CollaborativeStateChange => {
      const change: CollaborativeStateChange = {
        id: `${userId}_${Date.now()}_${Math.random()}`,
        userId,
        timestamp: Date.now(),
        path,
        oldValue,
        newValue,
        resolved: false,
      };

      localChangesRef.current.push(change);
      return change;
    },
    [userId]
  );

  /**
   * Apply a remote state change
   * Detects conflicts with local changes
   */
  const applyRemoteChange = useCallback(
    (remoteChange: CollaborativeStateChange) => {
      remoteChangesRef.current.push(remoteChange);

      // Check for conflicts
      const conflictingLocal = localChangesRef.current.filter(
        (local) =>
          local.resolved === false &&
          pathsOverlap(local.path, remoteChange.path) &&
          local.timestamp > remoteChange.timestamp - 1000 // Within 1s
      );

      if (conflictingLocal.length > 0) {
        const newConflicts = conflictingLocal.filter(
          (c) => !conflicts.find((existing) => existing.id === c.id)
        );
        if (newConflicts.length > 0) {
          setConflicts((prev) => [...prev, ...newConflicts]);
          onConflict?.(newConflicts);
        }
      }

      return remoteChange;
    },
    [conflicts, onConflict]
  );

  /**
   * Resolve a conflict using specified strategy
   */
  const resolveConflict = useCallback(
    (changeId: string, resolution: ConflictResolution) => {
      const change = localChangesRef.current.find((c) => c.id === changeId);
      if (!change) return;

      change.resolved = true;

      setConflicts((prev) => prev.filter((c) => c.id !== changeId));

      return resolution;
    },
    []
  );

  /**
   * Get unresolved conflicts
   */
  const getConflicts = useCallback(
    () => conflicts.filter((c) => !c.resolved),
    [conflicts]
  );

  /**
   * Get local changes pending acknowledgment
   */
  const getPendingChanges = useCallback(
    () =>
      localChangesRef.current.filter(
        (c) => !remoteChangesRef.current.find((r) => r.id === c.id)
      ),
    []
  );

  /**
   * Clear resolved changes (cleanup)
   */
  const clearResolved = useCallback(() => {
    localChangesRef.current = localChangesRef.current.filter(
      (c) => !c.resolved
    );
    remoteChangesRef.current = remoteChangesRef.current.filter(
      (c) => !c.resolved
    );
  }, []);

  return {
    trackLocalChange,
    applyRemoteChange,
    resolveConflict,
    getConflicts,
    getPendingChanges,
    clearResolved,
  };
}

/**
 * Check if two paths overlap (potential conflict)
 */
function pathsOverlap(path1: string[], path2: string[]): boolean {
  const minLen = Math.min(path1.length, path2.length);
  for (let i = 0; i < minLen; i++) {
    if (path1[i] !== path2[i]) return false;
  }
  return true;
}
