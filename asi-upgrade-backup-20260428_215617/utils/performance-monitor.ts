// src/utils/performance-monitor.ts
// Real-time Performance Monitoring Utility
// Tracks CPU, memory, frame rate, and component-level bottlenecks

interface ComponentMetric {
  name: string;
  avgTime: number;
  maxTime: number;
  minTime: number;
  calls: number;
  totalTime: number;
}

interface PerformanceSnapshot {
  timestamp: number;
  fps: number;
  cpuUsage: number;
  memoryUsage: number;
  frameTime: number;
  components: Map<string, ComponentMetric>;
}

export class PerformanceMonitor {
  private isRunning: boolean = false;
  private frameCount: number = 0;
  private lastFrameTime: number = 0;
  private fpsHistory: number[] = [];
  private componentMetrics: Map<string, ComponentMetric> = new Map();
  private animationFrameId: number | null = null;
  private startTime: number = 0;
  private snapshots: PerformanceSnapshot[] = [];
  private maxSnapshots: number = 100;

  // Performance tracking
  private frameStartTime: number = 0;
  private lastFpsUpdate: number = 0;
  private currentFps: number = 60;

  constructor() {
    this.lastFrameTime = performance.now();
    this.lastFpsUpdate = performance.now();
  }

  /**
   * Start monitoring performance
   */
  start(): void {
    if (this.isRunning) {
      console.warn('[PerformanceMonitor] Already running');
      return;
    }

    this.isRunning = true;
    this.startTime = performance.now();
    this.frameCount = 0;
    this.lastFrameTime = this.startTime;
    this.lastFpsUpdate = this.startTime;

    this.measureLoop();

    console.log('[PerformanceMonitor] Started');
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    this.isRunning = false;

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    console.log('[PerformanceMonitor] Stopped');
  }

  /**
   * Main measurement loop
   */
  private measureLoop = (): void => {
    if (!this.isRunning) return;

    const now = performance.now();
    this.frameStartTime = now;

    // Calculate FPS
    const deltaTime = now - this.lastFrameTime;
    this.lastFrameTime = now;

    if (deltaTime > 0) {
      const instantFps = 1000 / deltaTime;
      this.fpsHistory.push(instantFps);

      // Keep only last 60 frames
      if (this.fpsHistory.length > 60) {
        this.fpsHistory.shift();
      }
    }

    // Update FPS every second
    if (now - this.lastFpsUpdate >= 1000) {
      this.currentFps = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;
      this.lastFpsUpdate = now;

      // Create snapshot
      this.createSnapshot();
    }

    this.frameCount++;
    this.animationFrameId = requestAnimationFrame(this.measureLoop);
  };

  /**
   * Create performance snapshot
   */
  private createSnapshot(): void {
    const snapshot: PerformanceSnapshot = {
      timestamp: performance.now(),
      fps: this.currentFps,
      cpuUsage: this.estimateCPUUsage(),
      memoryUsage: this.getMemoryUsage(),
      frameTime: this.getAverageFrameTime(),
      components: new Map(this.componentMetrics)
    };

    this.snapshots.push(snapshot);

    // Trim old snapshots
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }
  }

  /**
   * Measure a component's execution time
   */
  measureComponent<T>(name: string, fn: () => T): T {
    const startTime = performance.now();
    const result = fn();
    const endTime = performance.now();
    const duration = endTime - startTime;

    this.recordComponentMetric(name, duration);

    return result;
  }

  /**
   * Measure async component's execution time
   */
  async measureComponentAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const startTime = performance.now();
    const result = await fn();
    const endTime = performance.now();
    const duration = endTime - startTime;

    this.recordComponentMetric(name, duration);

    return result;
  }

  /**
   * Record component metric
   */
  private recordComponentMetric(name: string, duration: number): void {
    let metric = this.componentMetrics.get(name);

    if (!metric) {
      metric = {
        name,
        avgTime: 0,
        maxTime: 0,
        minTime: Infinity,
        calls: 0,
        totalTime: 0
      };
      this.componentMetrics.set(name, metric);
    }

    metric.calls++;
    metric.totalTime += duration;
    metric.avgTime = metric.totalTime / metric.calls;
    metric.maxTime = Math.max(metric.maxTime, duration);
    metric.minTime = Math.min(metric.minTime, duration);
  }

  /**
   * Estimate CPU usage (approximation)
   */
  private estimateCPUUsage(): number {
    const frameTime = this.getAverageFrameTime();
    const targetFrameTime = 1000 / 60; // 60fps target

    // Rough estimate: if we're taking 16ms per frame, we're using 100% CPU
    const cpuUsage = Math.min(100, (frameTime / targetFrameTime) * 100);

    return cpuUsage;
  }

  /**
   * Get memory usage
   */
  private getMemoryUsage(): number {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
    }
    return 0;
  }

  /**
   * Get average frame time
   */
  private getAverageFrameTime(): number {
    if (this.fpsHistory.length === 0) return 0;

    const avgFps = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;
    return 1000 / avgFps;
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return {
      fps: this.currentFps,
      frameTime: this.getAverageFrameTime(),
      cpuUsage: this.estimateCPUUsage(),
      memoryUsage: this.getMemoryUsage(),
      frameCount: this.frameCount,
      runtime: performance.now() - this.startTime
    };
  }

  /**
   * Get component metrics
   */
  getComponentMetrics(): ComponentMetric[] {
    return Array.from(this.componentMetrics.values());
  }

  /**
   * Get top bottlenecks (slowest components)
   */
  getBottlenecks(count: number = 10): ComponentMetric[] {
    return Array.from(this.componentMetrics.values())
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, count);
  }

  /**
   * Get performance snapshots
   */
  getSnapshots(duration?: number): PerformanceSnapshot[] {
    if (!duration) {
      return [...this.snapshots];
    }

    const cutoff = performance.now() - duration * 1000;
    return this.snapshots.filter(s => s.timestamp >= cutoff);
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.componentMetrics.clear();
    this.fpsHistory = [];
    this.snapshots = [];
    this.frameCount = 0;
  }

  /**
   * Get performance report
   */
  getReport(): string {
    const metrics = this.getMetrics();
    const bottlenecks = this.getBottlenecks(5);

    let report = '=== PERFORMANCE REPORT ===\n\n';
    report += `FPS: ${metrics.fps.toFixed(1)}\n`;
    report += `Frame Time: ${metrics.frameTime.toFixed(2)}ms\n`;
    report += `CPU Usage: ${metrics.cpuUsage.toFixed(1)}%\n`;
    report += `Memory Usage: ${metrics.memoryUsage.toFixed(1)}%\n`;
    report += `Runtime: ${(metrics.runtime / 1000).toFixed(1)}s\n`;
    report += `Frames: ${metrics.frameCount}\n\n`;

    report += '=== TOP BOTTLENECKS ===\n\n';
    bottlenecks.forEach((metric, index) => {
      report += `${index + 1}. ${metric.name}\n`;
      report += `   Avg: ${metric.avgTime.toFixed(2)}ms\n`;
      report += `   Max: ${metric.maxTime.toFixed(2)}ms\n`;
      report += `   Calls: ${metric.calls}\n`;
      report += `   Total: ${metric.totalTime.toFixed(2)}ms\n\n`;
    });

    return report;
  }

  /**
   * Export metrics as JSON
   */
  exportMetrics(): string {
    return JSON.stringify({
      metrics: this.getMetrics(),
      components: this.getComponentMetrics(),
      snapshots: this.snapshots
    }, null, 2);
  }

  /**
   * Check if performance is degraded
   */
  isPerformanceDegraded(): boolean {
    const metrics = this.getMetrics();
    return metrics.fps < 30 || metrics.cpuUsage > 80;
  }

  /**
   * Get performance grade (A-F)
   */
  getPerformanceGrade(): string {
    const metrics = this.getMetrics();
    const fps = metrics.fps;
    const cpu = metrics.cpuUsage;

    if (fps >= 58 && cpu < 30) return 'A';
    if (fps >= 50 && cpu < 50) return 'B';
    if (fps >= 40 && cpu < 70) return 'C';
    if (fps >= 30 && cpu < 85) return 'D';
    return 'F';
  }
}

// Singleton instance
let monitorInstance: PerformanceMonitor | null = null;

export function getPerformanceMonitor(): PerformanceMonitor {
  if (!monitorInstance) {
    monitorInstance = new PerformanceMonitor();
  }
  return monitorInstance;
}

export function resetPerformanceMonitor(): void {
  if (monitorInstance) {
    monitorInstance.stop();
    monitorInstance = null;
  }
}

// React hook for performance monitoring
export function usePerformanceMonitor() {
  const monitor = getPerformanceMonitor();

  return {
    start: () => monitor.start(),
    stop: () => monitor.stop(),
    getMetrics: () => monitor.getMetrics(),
    getBottlenecks: (count?: number) => monitor.getBottlenecks(count),
    getReport: () => monitor.getReport(),
    measureComponent: <T,>(name: string, fn: () => T) => monitor.measureComponent(name, fn),
    isPerformanceDegraded: () => monitor.isPerformanceDegraded(),
    getGrade: () => monitor.getPerformanceGrade(),
  };
}