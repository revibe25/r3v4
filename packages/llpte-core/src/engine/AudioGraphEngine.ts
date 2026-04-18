import type { AudioGraph, AudioGraphMutation, NodeId, AudioNode } from "../types";
import { validateAudioGraph } from "../types";

/**
 * AudioGraphEngine — sample-accurate, mutation-driven audio graph executor.
 *
 * Invariants:
 *   - Graph is validated before any mutation is applied.
 *   - Processing order derived via Kahn's topological sort.
 *   - Cycles throw immediately rather than corrupting audio output.
 *   - All mutations are recorded immutably for undo/replay.
 */
export class AudioGraphEngine {
  private graph: AudioGraph;
  private readonly mutationLog: AudioGraphMutation[] = [];
  private processingOrder: NodeId[] = [];
  private isRunning = false;

  constructor(graph: AudioGraph) {
    const errors = validateAudioGraph(graph);
    if (errors.length > 0)
      throw new Error(`AudioGraphEngine: invalid graph — ${errors.join("; ")}`);
    this.graph = graph;
    this.processingOrder = this.topoSort();
  }

  start(): void { if (!this.isRunning) this.isRunning = true; }
  stop():  void { this.isRunning = false; }

  applyMutation(mutation: AudioGraphMutation): void {
    const errors = this.validateMutation(mutation);
    if (errors.length > 0) throw new Error(`Invalid mutation: ${errors.join("; ")}`);
    this.mutationLog.push(mutation);
    this.graph = this.reduceMutation(this.graph, mutation);
    this.processingOrder = this.topoSort();
  }

  getNode(id: NodeId): AudioNode | undefined { return this.graph.nodes.get(id); }
  getProcessingOrder(): readonly NodeId[]     { return this.processingOrder; }
  getMutationLog(): readonly AudioGraphMutation[] { return this.mutationLog; }

  private validateMutation(m: AudioGraphMutation): string[] {
    const errors: string[] = [];
    if (!m.timestamp || m.timestamp <= 0) errors.push("Mutation must have a positive timestamp");
    return errors;
  }

  private reduceMutation(graph: AudioGraph, mutation: AudioGraphMutation): AudioGraph {
    if (mutation.type === "SET_PARAM") {
      const { nodeId, paramId, value } = mutation.payload as {
        nodeId: NodeId; paramId: string; value: number;
      };
      const node = graph.nodes.get(nodeId);
      if (!node) return graph;
      const updated = new Map(graph.nodes);
      updated.set(nodeId, { ...node, parameters: { ...node.parameters, [paramId]: value } });
      return { ...graph, nodes: updated };
    }
    return graph;
  }

  /** Kahn's algorithm — topological sort; throws on cycle */
  private topoSort(): NodeId[] {
    const inDegree = new Map<NodeId, number>();
    for (const id of this.graph.nodes.keys()) inDegree.set(id, 0);
    for (const edge of this.graph.edges) {
      for (const [id, node] of this.graph.nodes) {
        if (node.inputs.some((p) => p.id === edge.targetPort))
          inDegree.set(id, (inDegree.get(id) ?? 0) + 1);
      }
    }
    const queue: NodeId[] = [];
    for (const [id, deg] of inDegree) if (deg === 0) queue.push(id);
    const order: NodeId[] = [];
    while (queue.length > 0) {
      const id = queue.shift()!;
      order.push(id);
      for (const edge of this.graph.edges) {
        const srcNode = [...this.graph.nodes.values()].find((n) =>
          n.outputs.some((p) => p.id === edge.sourcePort)
        );
        if (srcNode?.id !== id) continue;
        for (const [tid, tnode] of this.graph.nodes) {
          if (tnode.inputs.some((p) => p.id === edge.targetPort)) {
            const deg = (inDegree.get(tid) ?? 1) - 1;
            inDegree.set(tid, deg);
            if (deg === 0) queue.push(tid);
          }
        }
      }
    }
    if (order.length !== this.graph.nodes.size)
      throw new Error("AudioGraphEngine: cycle detected — processing halted");
    return order;
  }
}
