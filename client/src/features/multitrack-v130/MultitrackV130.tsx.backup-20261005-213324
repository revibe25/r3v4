import {
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { getAudioGraph } from '@/audio/core/audio-graph';
import { useV130Runtime } from './runtime/useV130Runtime';
import { useV130CanvasRegistry } from './renderers/useV130CanvasRegistry';
import { useV130PresentationRuntime } from './renderers/useV130PresentationRuntime';
import { useV130Viewport } from './layout/useV130Viewport';
import V130ReferenceDomShell from './reference/V130ReferenceDomShell';

import './styles/reference.css';
import './styles/host.css';

export default function MultitrackV130() {
  const hostRef =
    useRef<HTMLDivElement | null>(null);

  const [
    host,
    setHost,
  ] =
    useState<HTMLDivElement | null>(
      null,
    );

  // Initialize the shared audio graph singleton once and expose it
  // through React state so dependent runtimes receive the live instance.
  const [audioGraph, setAudioGraph] =
    useState<ReturnType<typeof getAudioGraph> | null>(null);

  useLayoutEffect(() => {
    const graph = getAudioGraph();
    setAudioGraph(graph);
    (window as any).__audioGraph = graph;
  }, []);

  const viewport =
    useV130Viewport(host);

  const canvasRegistry =
    useV130CanvasRegistry(
      hostRef,
      viewport,
    );

  useV130PresentationRuntime(
    hostRef,
    viewport,
    canvasRegistry,
    audioGraph,
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
      data-v130-stage-width={
        viewport.logicalWidth
      }
      data-v130-stage-height={
        viewport.logicalHeight
      }
      data-v130-scale={
        viewport.scale
      }
      aria-label="R3 NATIVE Multitrack v1.3.0"
    >
      <V130ReferenceDomShell
        viewport={viewport}
        audioGraph={audioGraph}
      />
    </div>
  );
}
