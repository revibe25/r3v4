// client/src/audio/fx/vst-performance-monitor.ts
import {
  PerformanceMonitor,
  PerformanceSnapshot,
  CPUMetrics,
  MemoryMetrics,
  LatencyMetrics,
  EffectPerformance,
  ChannelPerformance,
  EffectType
} from '@/types/audio';

export interface PerformanceMetrics {
  cpuUsage: number; // Percentage
  latency: number; // Milliseconds
  bufferUnderruns: number;
  processingTime: number; // Average ms per buffer
  peakProcessingTime: number;
  memoryUsage: number; // MB
}

export class VSTPerformanceMonitor implements PerformanceMonitor {
  // ── PerformanceMonitor interface stubs ────────────────────
  isMonitoring: boolean = false;
  start(): void { this.isMonitoring = true; }
  stop(): void  { this.isMonitoring = false; }
  getCurrentSnapshot(): PerformanceSnapshot { return {}; }
  getHistory(_limit?: number): PerformanceSnapshot[] { return []; }
  clearHistory(): void {}
  getAverageLoad(): number { return 0; }
  getPeakLoad(): number { return 0; }
  onOverload(_cb: () => void): void {}
  // ───────────────────────────────────────────────────────────

  private metrics: Map<string, PerformanceMetrics> = new Map();
  private measurementWindow = 100; // Number of samples to average
  private measurements: Map<string, number[]> = new Map();
  private audioContext: AudioContext;
  private monitoringInterval: number | null = null;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
  }

  /**
   * Start monitoring a VST
   */
  startMonitoring(vstId: string): void {
    if (!this.metrics.has(vstId)) {
      this.metrics.set(vstId, {
        cpuUsage: 0,
        latency: 0,
        bufferUnderruns: 0,
        processingTime: 0,
        peakProcessingTime: 0,
        memoryUsage: 0,
      });
      this.measurements.set(vstId, []);
    }

    if (!this.monitoringInterval) {
      this.monitoringInterval = window.setInterval(() => {
        this.updateMetrics();
      }, 100);
    }
  }

  /**
   * Stop monitoring a VST
   */
  stopMonitoring(vstId: string): void {
    this.metrics.delete(vstId);
    this.measurements.delete(vstId);

    if (this.metrics.size === 0 && this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Record a processing time measurement
   */
  recordProcessingTime(vstId: string, timeMs: number): void {
    const measurements = this.measurements.get(vstId);
    if (!measurements) return;

    measurements.push(timeMs);

    // Keep only last N measurements
    if (measurements.length > this.measurementWindow) {
      measurements.shift();
    }

    // Update metrics
    const metrics = this.metrics.get(vstId);
    if (metrics) {
      metrics.processingTime = this.calculateAverage(measurements);
      metrics.peakProcessingTime = Math.max(...measurements);
      
      // Calculate CPU usage (simplified)
      const bufferDuration = 128 / this.audioContext.sampleRate * 1000;
      metrics.cpuUsage = (metrics.processingTime / bufferDuration) * 100;
    }
  }

  /**
   * Get metrics for a specific VST
   */
  getMetrics(vstId: string): PerformanceMetrics | null {
    return this.metrics.get(vstId) || null;
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Map<string, PerformanceMetrics> {
    return new Map(this.metrics);
  }

  /**
   * Get total system CPU usage
   */
  getTotalCPUUsage(): number {
    let total = 0;
    this.metrics.forEach(m => {
      total += m.cpuUsage;
    });
    return total;
  }

  /**
   * Get optimization recommendations
   */
  getOptimizationRecommendations(vstId: string): string[] {
    const metrics = this.metrics.get(vstId);
    if (!metrics) return [];

    const recommendations: string[] = [];

    if (metrics.cpuUsage > 80) {
      recommendations.push('High CPU usage detected. Consider freezing this track.');
    }

    if (metrics.latency > 20) {
      recommendations.push('High latency detected. Try reducing buffer size.');
    }

    if (metrics.bufferUnderruns > 10) {
      recommendations.push('Buffer underruns detected. Increase buffer size or reduce plugin count.');
    }

    if (metrics.peakProcessingTime > metrics.processingTime * 3) {
      recommendations.push('Unstable processing times. This plugin may cause audio glitches.');
    }

    return recommendations;
  }

  private updateMetrics(): void {
    // Update memory usage (if available)
    if ('memory' in performance && (performance as any).memory) {
      const memory = (performance as any).memory;
      const usedMB = memory.usedJSHeapSize / 1024 / 1024;
      
      this.metrics.forEach(metrics => {
        metrics.memoryUsage = usedMB;
      });
    }
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    const sum = values.reduce((a, b) => a + b, 0);
    return sum / values.length;
  }

  /**
   * Dispose monitor
   */
  dispose(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.metrics.clear();
    this.measurements.clear();
  }
}

// Wrap VST processing with performance monitoring
export function wrapWithPerformanceMonitoring(
  vstNode: any,
  monitor: VSTPerformanceMonitor,
  vstId: string
): void {
  const originalProcess = vstNode.process;
  
  vstNode.process = function(...args: any[]) {
    const startTime = performance.now();
    const result = originalProcess.apply(this, args);
    const endTime = performance.now();
    
    monitor.recordProcessingTime(vstId, endTime - startTime);
    
    return result;
  };

}