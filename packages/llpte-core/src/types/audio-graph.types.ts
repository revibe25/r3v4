/**
 * Audio Node Graph — Canonical Type Contracts
 * All packages MUST import from here. No duplicate definitions.
 */
export type NodeId    = string & { readonly __brand: "NodeId" };
export type PortId    = string & { readonly __brand: "PortId" };
export type Milliseconds = number & { readonly __brand: "ms" };
export type SampleRate = 44100 | 48000 | 88200 | 96000;
export type BufferSize = 128 | 256 | 512 | 1024 | 2048;

export interface AudioPort {
  readonly id: PortId;
  readonly nodeId: NodeId;
  readonly direction: "input" | "output";
  readonly channelCount: number;
}

export interface AudioNode {
  readonly id: NodeId;
  readonly type: string;
  readonly inputs: AudioPort[];
  readonly outputs: AudioPort[];
  readonly parameters: Record<string, number>;
  readonly enabled: boolean;
}

export interface AudioEdge {
  readonly id: string;
  readonly sourcePort: PortId;
  readonly targetPort: PortId;
}

export interface AudioGraph {
  readonly nodes: Map<NodeId, AudioNode>;
  readonly edges: AudioEdge[];
  readonly sampleRate: SampleRate;
  readonly bufferSize: BufferSize;
}

export interface AudioGraphMutation {
  type: "ADD_NODE" | "REMOVE_NODE" | "ADD_EDGE" | "REMOVE_EDGE" | "SET_PARAM";
  payload: unknown;
  timestamp: Milliseconds;
}

/** Invariant: every edge's source and target must reference existing port IDs */
export function validateAudioGraph(graph: AudioGraph): string[] {
  const errors: string[] = [];
  const portIndex = new Set<PortId>();
  for (const node of graph.nodes.values()) {
    for (const p of [...node.inputs, ...node.outputs]) portIndex.add(p.id);
  }
  for (const edge of graph.edges) {
    if (!portIndex.has(edge.sourcePort))
      errors.push(`Edge ${edge.id}: sourcePort ${edge.sourcePort} not found`);
    if (!portIndex.has(edge.targetPort))
      errors.push(`Edge ${edge.id}: targetPort ${edge.targetPort} not found`);
  }
  return errors;
}
