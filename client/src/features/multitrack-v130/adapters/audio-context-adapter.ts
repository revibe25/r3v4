import {
  ensureAudioRunning,
  getAudioContext,
} from '@/audio/core/audio-context';

export function getV130AudioContext(): AudioContext {
  return getAudioContext();
}

export async function ensureV130AudioRunning(): Promise<AudioContext> {
  return ensureAudioRunning();
}
