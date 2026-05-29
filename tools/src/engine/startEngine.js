import { initEngine } from "./initEngine";

let engineInstance = null;

export function startEngine(audioCtx, analyser) {
  if (engineInstance) return engineInstance;

  engineInstance = initEngine(audioCtx, analyser);
  return engineInstance;
}
