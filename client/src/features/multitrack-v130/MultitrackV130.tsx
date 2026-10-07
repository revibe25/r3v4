import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { ensureAudioRunning } from "@/audio/core/audio-context";
import { getAudioGraph } from "@/audio/core/audio-graph";
import { useAudioGraphState } from './hooks/useAudioGraphState';
import { useMountPanKnobs } from './hooks/useMountPanKnobs';
import { useV130Runtime } from "./runtime/useV130Runtime";
import { useV130CanvasRegistry } from "./renderers/useV130CanvasRegistry";
import { useV130PresentationRuntime } from "./renderers/useV130PresentationRuntime";
import { useV130Viewport } from "./layout/useV130Viewport";
import V130ReferenceDomShell from "./reference/V130ReferenceDomShell";

// NEW: Import the generated components
import {
  HeaderBrand,
  ClockDisplay,
  PanKnob,
  SendFader,
  ParameterKnob,
  PluginEditor,
  AutomationLane,
  ArrangeMarkers,
  StatusBar,
  Footer,
} from "./components";

import "./styles/reference.css";
import "./styles/host.css";

export default function MultitrackV130() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const handleHostRef = useCallback((node: HTMLDivElement | null) => {
    hostRef.current = node;
    setHost(node);
  }, []);

  const [host, setHost] = useState<HTMLDivElement | null>(null);

  // Initialize the shared audio graph singleton once and expose it
  // through React state so dependent runtimes receive the live instance.
  const [audioGraph, setAudioGraph] = useState<
    ReturnType<typeof getAudioGraph> | null
  >(null);

  useLayoutEffect(() => {
    const graph = getAudioGraph();
    setAudioGraph(graph);
    (window as any).__audioGraph = graph;
  }, []);
  useLayoutEffect(() => {
    if (audioGraph) {
      ensureAudioRunning().catch(err => console.error('Failed to start audio engine:', err));
      
      // Create and inject the resume button into the DOM
      const existingBtn = document.getElementById('audio-resume-btn');
      if (!existingBtn) {
        const btn = document.createElement('button');
        btn.id = 'audio-resume-btn';
        btn.textContent = '🎵 Resume Audio';
        btn.onclick = () => ensureAudioRunning().catch(err => console.error('Audio resume failed:', err));
        btn.style.cssText = 'position: fixed; top: 60px; right: 20px; padding: 10px 16px; background-color: #00ff00; color: #000; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; z-index: 9999; font-size: 12px;';
        document.body.appendChild(btn);
      }
    }
  }, [audioGraph]);
  // Wire ClockDisplay with live audio + DAW state
  const audioState = useAudioGraphState();
  // Mount PanKnobController in mixer strips
  useMountPanKnobs();

  const viewport = useV130Viewport(host);

  const canvasRegistry = useV130CanvasRegistry(hostRef, viewport);

  useV130PresentationRuntime(
    hostRef,
    viewport,
    canvasRegistry,
    audioGraph
  );

  useV130Runtime(hostRef);

  return (
    <div
      ref={(node) => {
        hostRef.current = node;
        setHost(node);
      }}
      className="r3-multitrack-v130"
      data-v130-root="true"
      data-v130-stage-width={viewport.logicalWidth}
      data-v130-stage-height={viewport.logicalHeight}
      data-v130-scale={viewport.scale}
      aria-label="R3 NATIVE Multitrack v1.3.0"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        width: "100vw",
      }}
    >
      {/* NEW: Header with branding and clock */}
      <div
        style={{
          borderBottom: "1px solid #16252c",
          flexShrink: 0,
        }}
      >
        <HeaderBrand />
        <ClockDisplay currentTime={audioState.currentTime} bpm={audioState.bpm} timeSignature={{ numerator: audioState.timeSignature[0], denominator: audioState.timeSignature[1] }} />
      </div>

      {/* Canvas-based render system */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          minHeight: 0,
        }}
      >
        <V130ReferenceDomShell viewport={viewport} audioGraph={audioGraph} />
      </div>

      {/* NEW: Status bar with render/audio/MIDI/export status */}
      <div style={{ flexShrink: 0 }}>
      {/* NEW: Status bar with render/audio/MIDI/export status */}
      <div style={{ flexShrink: 0 }}>
        <StatusBar
          isRendering={false}
          audioEngineStatus="online"
          midiRoutingValid={true}
          canExport={true}
        />
      </div>
      </div>

      {/* NEW: Footer with version and links */}
      <div style={{ flexShrink: 0 }}>
        <Footer />
      </div>
    </div>
  );
}

