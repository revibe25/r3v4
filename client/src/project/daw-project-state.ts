/**
 * client/src/project/daw-project-state.ts
 *
 * Canonical serialization boundary for the live DAW project.
 *
 * Live UI/store colors may use semantic CSS variables such as
 * var(--looper-cyan). The server persistence schema intentionally stores
 * deterministic #RRGGBB values instead.
 */

import type {
  MidiPattern,
  Track,
  TrackRegion,
} from '../hooks/useDAWStore';
import { useDAWStore } from '../hooks/useDAWStore';

export interface PersistedDAWProjectState {
  bpm: number;
  timeSignature: [number, number];
  masterGain: number;
  tracks: Track[];
  regions: TrackRegion[];
  midiPatterns: MidiPattern[];
  loopEnabled: boolean;
  loopStart: number;
  loopEnd: number;
}

/**
 * Known DAW semantic colors.
 *
 * These are the colors actually used by the current DAW/store and are
 * intentionally concrete at the persistence boundary.
 */
const KNOWN_COLORS: Record<string, string> = {
  'var(--status-warn)': '#ffaa00',
  'var(--status-ok)': '#22c55e',
  'var(--accent-green)': '#22c55e',
  'var(--accent-purple)': '#8b5cf6',
  'var(--accent-violet)': '#8b5cf6',
  'var(--looper-cyan)': '#22d3ee',
  'var(--looper-pink)': '#f472b6',
  'var(--looper-lime)': '#84cc16',
  'var(--looper-acid-2)': '#32cd32',
  'var(--text-dim)': '#444444',
};

function normalizeHex(value: string): string | null {
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value;
  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    const body = value.slice(1);
    return `#${body[0]}${body[0]}${body[1]}${body[1]}${body[2]}${body[2]}`;
  }
  return null;
}

function resolveColor(value: string): string {
  const direct = normalizeHex(value);
  if (direct) return direct;

  const known = KNOWN_COLORS[value];
  if (known) return known;

  const variableMatch = value.match(/^var\((--[\w-]+)\)$/);
  if (variableMatch && typeof window !== 'undefined') {
    const resolved = getComputedStyle(document.documentElement)
      .getPropertyValue(variableMatch[1])
      .trim();

    const resolvedHex = normalizeHex(resolved);
    if (resolvedHex) return resolvedHex;

    const rgb = resolved.match(
      /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i,
    );

    if (rgb) {
      const channels = rgb.slice(1, 4).map(Number);
      if (channels.every((channel) => channel >= 0 && channel <= 255)) {
        return `#${channels
          .map((channel) => channel.toString(16).padStart(2, '0'))
          .join('')}`;
      }
    }
  }

  throw new Error(
    `Unsupported project color "${value}". ` +
    'Project colors must resolve to deterministic #RRGGBB values before save.',
  );
}

/**
 * Snapshot only the fields defined by server/routers/daw.ts ProjectStateSchema.
 *
 * This function does not mutate the Zustand store.
 */
export function serializeDAWProjectState(): PersistedDAWProjectState {
  const s = useDAWStore.getState();

  return {
    bpm: s.bpm,
    timeSignature: [s.timeSignature[0], s.timeSignature[1]],
    masterGain: s.masterGain,

    tracks: s.tracks.map((track) => ({
      ...track,
      color: resolveColor(track.color),
      fxChain: track.fxChain.map((fx) => ({
        ...fx,
        params: { ...fx.params },
      })),
      sends: track.sends.map((send) => ({ ...send })),
    })),

    regions: s.regions.map((region) => ({
      ...region,
      color: resolveColor(region.color),
    })),

    midiPatterns: s.midiPatterns.map((pattern) => ({
      ...pattern,
      notes: pattern.notes.map((note) => ({ ...note })),
    })),

    loopEnabled: s.loopEnabled,
    loopStart: s.loopStart,
    loopEnd: s.loopEnd,
  };
}
