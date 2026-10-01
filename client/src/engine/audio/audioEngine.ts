import { getAudioContext } from "@/audio/core/audio-context";
// CRIT-4: Never instantiate AudioContext at module level — it is a browser-only
// global and will throw in SSR, Vitest (jsdom), or any Node import path.
// Use the lazy singleton below; call getAudioEngine() only after mount.

export class AudioEngine {
  private ctx: AudioContext | null = null
  private rafHandle: number | null = null

  get context(): AudioContext {
    if (!this.ctx) {
      this.ctx = getAudioContext()
    }
    return this.ctx
  }

  start(): void {
    if (this.ctx?.state === 'suspended') {
      void this.ctx.resume()
    }
  }

  stop(): void {
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle)
      this.rafHandle = null
    }
  }

  async destroy(): Promise<void> {
    this.stop()
    // Shared AudioContext is owned by audio-context.ts; do not close it.
    this.ctx = null
  }
}

// Lazy singleton — module-level variable only holds null until first call
let _instance: AudioEngine | null = null
export function getAudioEngine(): AudioEngine {
  if (!_instance) _instance = new AudioEngine()
  return _instance
}
