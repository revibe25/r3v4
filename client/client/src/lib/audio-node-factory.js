// audio-node-factory.ts — Safe wrappers for audio nodes
//
// Root cause fixed: ConstantSourceNode and OscillatorNode wrappers called
// .start() while the AudioContext was still "suspended" (autoplay policy).
//
// Rule: never call node.start() directly — always use these factory functions.
import { audioContextManager } from "./audio-context-manager";
async function makeSafeHandle(node) {
    return {
        node,
        async start(when) {
            const ctx = await audioContextManager.ensureRunning();
            node.start(when ?? ctx.currentTime);
        },
        stop(when) {
            try {
                node.stop(when);
            }
            catch { /* already stopped */ }
        },
    };
}
export async function createSafeOscillator(type = "sine", frequency = 440) {
    const ctx = await audioContextManager.ensureRunning();
    const node = ctx.createOscillator();
    node.type = type;
    node.frequency.value = frequency;
    const handle = await makeSafeHandle(node);
    return { ...handle, node };
}
export async function createSafeConstantSource(offset = 1) {
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
export async function testNegativeStartParameterSupport(nativeContext) {
    if (nativeContext.state === "suspended") {
        await nativeContext.resume();
    }
    const osc = nativeContext.createOscillator();
    try {
        osc.start(-1);
    }
    catch (err) {
        return err instanceof RangeError;
    }
    return false;
}
