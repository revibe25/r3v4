// audio-node-factory.ts — Safe wrappers for audio nodes
//
// Root cause fixed: ConstantSourceNode and OscillatorNode wrappers called
// .start() while the AudioContext was still "suspended" (autoplay policy).
//
// Rule: never call node.start() directly — always use these factory functions.

import { audioContextManager } from "./audio-context-manager";

export interface SafeNodeHandle {
  node: AudioScheduledSourceNode;
  start: (when?: number) => Promise<void>;
  stop: (when?: number) => void;
}

async function makeSafeHandle(
  node: AudioScheduledSourceNode,
): Promise<SafeNodeHandle> {
  return {
    node,
    async start(when?: number) {
      const ctx = await audioContextManager.ensureRunning();
      node.start(when ?? ctx.currentTime);
    },
    stop(when?: number) {
      try { node.stop(when); } catch { /* already stopped */ }
    },
  };
}

export async function createSafeOscillator(
  type: OscillatorType = "sine",
  frequency = 440,
): Promise<SafeNodeHandle & { node: OscillatorNode }> {
  const ctx = await audioContextManager.ensureRunning();
  const node = ctx.createOscillator();
  node.type = type;
  node.frequency.value = frequency;
  const handle = await makeSafeHandle(node);
  return { ...handle, node };
}

export async function createSafeConstantSource(
  offset = 1,
): Promise<SafeNodeHandle & { node: ConstantSourceNode }> {
  const ctx = await audioContextManager.ensureRunning();
  const node = ctx.createConstantSource();
  node.offset.value = offset;
  const handle = await makeSafeHandle(node);
  return { ...handle, node };
}

/**
 * Drop-in replacement for testAudioScheduledSourceNodeStartMethodNegativeParametersSupport.
 * Original called .start(-1) while context was suspended — fixed here.
 */
export async function testNegativeStartParameterSupport(
  nativeContext: AudioContext,
): Promise<boolean> {
  if (nativeContext.state === "suspended") {
    await nativeContext.resume();
  }
  const osc = nativeContext.createOscillator();
  try {
    osc.start(-1);
  } catch (err) {
    return err instanceof RangeError;
  }
  return false;
}
