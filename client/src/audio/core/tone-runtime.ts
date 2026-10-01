/**
 * R3 canonical Tone.js runtime authority.
 *
 * Runtime Tone loading is deferred until an explicit user gesture.
 * The canonical native AudioContext is established before Tone is
 * dynamically imported, then Tone is rebound to that context and started.
 */

import { getAudioContext } from "./audio-context";

export type ToneRuntime = typeof import("tone");

let runtime: ToneRuntime | null = null;
let initPromise: Promise<ToneRuntime> | null = null;

const readyWaiters: Array<{
  resolve: (tone: ToneRuntime) => void;
  reject: (error: unknown) => void;
}> = [];

export function isToneReady(): boolean {
  return runtime !== null;
}

export function waitForToneReady(): Promise<ToneRuntime> {
  if (runtime) return Promise.resolve(runtime);

  return new Promise<ToneRuntime>((resolve, reject) => {
    readyWaiters.push({ resolve, reject });
  });
}

/**
 * Call only from an explicit user-gesture path.
 */
export function initializeToneFromGesture(): Promise<ToneRuntime> {
  if (runtime) {
    const canonicalContext = getAudioContext();

    if (canonicalContext.state === "suspended") {
      return canonicalContext.resume().then(() => runtime!);
    }

    return Promise.resolve(runtime);
  }

  if (initPromise) return initPromise;

  initPromise = (async () => {
    // Canonical R3 native context first.
    const canonicalContext = getAudioContext();

    // Resume from the explicit gesture path.
    if (canonicalContext.state === "suspended") {
      await canonicalContext.resume();
    }

    // Tone is not loaded until after the gesture.
    const imported = await import("tone");
    const importedModule = imported as any;
    const tone =
      typeof importedModule.setContext === "function"
        ? (importedModule as ToneRuntime)
        : (importedModule.default as ToneRuntime | undefined);

    if (
      !tone ||
      typeof (tone as any).setContext !== "function"
    ) {
      throw new Error(
        "R3 Tone runtime: installed Tone module does not expose setContext."
      );
    }

    // Tone 14.x supports disposeOld as the second parameter.
    (tone as any).setContext(canonicalContext, true);

    if (canonicalContext.state !== "running") {
      await canonicalContext.resume();
    }

    await (tone as any).start();

    runtime = tone;

    const waiters = readyWaiters.splice(0);
    for (const waiter of waiters) {
      try {
        waiter.resolve(tone);
      } catch {
        // Ignore individual waiter failures.
      }
    }

    return tone;
  })().catch((error) => {
    initPromise = null;

    const waiters = readyWaiters.splice(0);
    for (const waiter of waiters) {
      try {
        waiter.reject(error);
      } catch {
        // Ignore individual waiter failures.
      }
    }

    throw error;
  });

  return initPromise;
}

    
/**
 * Canonical runtime Tone namespace.
 *
 * This object does not load Tone and does not create an AudioContext.
 * Consumers may reference Tone only after the runtime has crossed the
 * explicit initialization/readiness boundary.
 */
export const Tone = new Proxy({} as ToneRuntime, {
  get(_target, property) {
    if (!runtime) {
      throw new Error(
        "R3 Tone runtime is not ready; initialize it from an explicit user gesture first."
      );
    }

    return Reflect.get(runtime, property);
  },
});
