// audio-context-manager.ts — AGI-scaling singleton for Web Audio API
//
// Root cause fixed: Chrome's Autoplay Policy blocks AudioContext from
// producing sound until a user gesture occurs. Any node.start() call while
// the context is "suspended" triggers the warning and produces no audio.
//
// Rule: ALL audio operations go through ensureRunning(). No caller holds
// a raw AudioContext reference — they receive a guaranteed-running context
// or an explicit rejection.

type ContextState = "suspended" | "running" | "closed";

class AudioContextManager {
  private static instance: AudioContextManager | null = null;
  private context: AudioContext | null = null;
  private resumeQueue: Array<{
    resolve: () => void;
    reject: (reason: unknown) => void;
  }> = [];

  private constructor() {}

  static getInstance(): AudioContextManager {
    if (!AudioContextManager.instance) {
      AudioContextManager.instance = new AudioContextManager();
    }
    return AudioContextManager.instance;
  }

  /**
   * Returns a guaranteed-running AudioContext.
   * MUST be called from within a user-gesture handler on first invocation.
   * Safe to call from anywhere once context is running — resolves instantly.
   */
  async ensureRunning(): Promise<AudioContext> {
    if (!this.context) {
      this.context = new AudioContext();
    }

    const state = this.context.state as ContextState;

    if (state === "closed") {
      throw new Error(
        "AudioContext is closed. Reset the AudioContextManager singleton.",
      );
    }

    if (state === "running") {
      return this.context;
    }

    // state === "suspended" — queue concurrent callers, resolve together
    return new Promise<AudioContext>((resolve, reject) => {
      this.resumeQueue.push({
        resolve: () => resolve(this.context!),
        reject,
      });

      if (this.resumeQueue.length === 1) {
        this.context!.resume().then(
          () => {
            const q = this.resumeQueue.splice(0);
            for (const item of q) item.resolve();
          },
          (err: unknown) => {
            const q = this.resumeQueue.splice(0);
            for (const item of q) item.reject(err);
          },
        );
      }
    });
  }

  getState(): ContextState | "uninitialised" {
    if (!this.context) return "uninitialised";
    return this.context.state as ContextState;
  }

  /** Call on teardown / test reset only */
  async close(): Promise<void> {
    if (this.context && this.context.state !== "closed") {
      await this.context.close();
    }
    this.context = null;
    AudioContextManager.instance = null;
  }
}

export const audioContextManager = AudioContextManager.getInstance();
export type { ContextState };
