/// <reference types="vite/client" />

interface FXNode {
  readonly id: string;
  readonly context: AudioContext;
  readonly input: AudioNode;
  readonly output: AudioNode;
  readonly bypassed: boolean;
  connect(destination: AudioNode): void;
  disconnect(): void;
  setBypass(bypass: boolean): void;
  dispose(): void;
  bypass(enabled: boolean): void;
  setWetDry(wet: number, dry?: number): void;
  setParam(name: string, value: number): void;
  getParam(name: string): number;
  getParams(): Record<string, number>;
}

// Ambient declarations for missing modules and Web APIs

// Ableton Link
declare module 'abletonlink' {
  export default class AbletonLink {
    constructor(bpm?: number);
    bpm: number;
    quantum: number;
    isEnabled: boolean;
    isConnected: boolean;
    enable(): void;
    disable(): void;
    startPlaying(): void;
    stopPlaying(): void;
    on(event: string, listener: (...args: unknown[]) => void): this;
    off(event: string, listener: (...args: unknown[]) => void): this;
  }
}

// webkit Speech Recognition
interface Window {
  webkitSpeechRecognition: typeof SpeechRecognition;
}
declare var webkitSpeechRecognition: typeof SpeechRecognition;

// WebMidi (minimal namespace)
declare namespace WebMidi {
  interface MIDIAccess {
    inputs: Map<string, MIDIInput>;
    outputs: Map<string, MIDIOutput>;
    sysexEnabled: boolean;
    onstatechange: ((e: MIDIConnectionEvent) => void) | null;
  }
  interface MIDIPort extends EventTarget {
    id: string;
    name: string | null;
    manufacturer: string | null;
    type: 'input' | 'output';
    state: 'disconnected' | 'connected';
    connection: 'open' | 'closed' | 'pending';
    open(): Promise<MIDIPort>;
    close(): Promise<MIDIPort>;
  }
  interface MIDIInput extends MIDIPort {
    type: 'input';
    onmidimessage: ((e: MIDIMessageEvent) => void) | null;
  }
  interface MIDIOutput extends MIDIPort {
    type: 'output';
    send(data: number[] | Uint8Array, timestamp?: number): void;
    clear(): void;
  }
  interface MIDIMessageEvent extends Event {
    data: Uint8Array;
  }
  interface MIDIConnectionEvent extends Event {
    port: MIDIPort;
  }
}

// @react-three/drei
declare module '@react-three/drei' {
  export const OrbitControls: React.FC<Record<string, unknown>>;
  export const Text: React.FC<Record<string, unknown>>;
  export const Html: React.FC<Record<string, unknown>>;
  export const useGLTF: (url: string) => Record<string, unknown>;
  export const Line: React.FC<Record<string, unknown>>;
}

// react-resizable-panels re-export compat
declare module 'react-resizable-panels' {
  import type * as React from 'react';
  export const PanelGroup: React.FC<React.HTMLAttributes<HTMLDivElement> & {
    direction: 'horizontal' | 'vertical';
    onLayout?: (sizes: number[]) => void;
    autoSaveId?: string;
    className?: string;
    id?: string;
    style?: React.CSSProperties;
  }>;
  export const Panel: React.FC<React.HTMLAttributes<HTMLDivElement> & {
    defaultSize?: number;
    minSize?: number;
    maxSize?: number;
    collapsible?: boolean;
    collapsedSize?: number;
    onCollapse?: () => void;
    onExpand?: () => void;
    onResize?: (size: number) => void;
    className?: string;
    id?: string;
    order?: number;
    style?: React.CSSProperties;
  }>;
  export const PanelResizeHandle: React.FC<React.HTMLAttributes<HTMLDivElement> & {
    disabled?: boolean;
    className?: string;
    id?: string;
    style?: React.CSSProperties;
    hitAreaMargins?: { coarse: number; fine: number };
    onDragging?: (isDragging: boolean) => void;
    tabIndex?: number;
  }>;
}
