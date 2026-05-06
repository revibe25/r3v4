/**
 * useVUMeter — React hook that connects a WebAudio source node to the
 * VU meter AudioWorklet and returns live peak/RMS values.
 *
 * Usage:
 *   const { peakL, peakR, rmsL, rmsR } = useVUMeter(audioContext, sourceNode);
 */
import { useState, useEffect, useRef } from "react";

export interface VUMeterData {
  peakL: number; peakR: number;
  rmsL:  number; rmsR:  number;
}

const ZERO: VUMeterData = { peakL: 0, peakR: 0, rmsL: 0, rmsR: 0 };

// Cache so we only load the worklet module once per AudioContext
const loadedContexts = new WeakSet<AudioContext>();

export function useVUMeter(
  audioContext: AudioContext | null,
  sourceNode:   AudioNode    | null,
  intervalMs  = 50,
): VUMeterData {
  const [data, setData] = useState<VUMeterData>(ZERO);
  const workletRef = useRef<AudioWorkletNode | null>(null);

  useEffect(() => {
    if (!audioContext || !sourceNode) return;
    let active = true;

    const setup = async () => {
      try {
        if (!loadedContexts.has(audioContext)) {
          await audioContext.audioWorklet.addModule(
            new URL("./vu-meter-processor.ts", import.meta.url).href
          );
          loadedContexts.add(audioContext);
        }
        if (!active) return;

        const worklet = new AudioWorkletNode(audioContext, "vu-meter-processor", {
          numberOfInputs:  1,
          numberOfOutputs: 0,
          processorOptions: { intervalMs },
        });

        worklet.port.onmessage = (e: MessageEvent<VUMeterData>) => {
          if (active) setData(e.data);
        };

        sourceNode.connect(worklet);
        workletRef.current = worklet;
      } catch (err) {
        console.warn("[useVUMeter] AudioWorklet unavailable, falling back:", err);
      }
    };

    setup();

    return () => {
      active = false;
      workletRef.current?.disconnect();
      workletRef.current = null;
      setData(ZERO);
    };
  }, [audioContext, sourceNode, intervalMs]);

  return data;
}
