import type { NodeId } from "../types";

/**
 * LatencyCompensator — tracks per-node latency; returns compensation delay per node.
 *
 * Invariant: all parallel signal paths must exit with equal total latency.
 */
export class LatencyCompensator {
  private readonly latencies = new Map<NodeId, number>(); // samples

  register(nodeId: NodeId, latencySamples: number): void {
    if (latencySamples < 0) throw new RangeError("Latency samples cannot be negative");
    this.latencies.set(nodeId, latencySamples);
  }

  getCompensation(nodeId: NodeId, targetLatency: number): number {
    const own = this.latencies.get(nodeId) ?? 0;
    return Math.max(0, targetLatency - own);
  }

  getTotalPathLatency(nodePath: NodeId[]): number {
    return nodePath.reduce((sum, id) => sum + (this.latencies.get(id) ?? 0), 0);
  }

  getMaxLatency(): number {
    return Math.max(0, ...[...this.latencies.values()]);
  }
}
