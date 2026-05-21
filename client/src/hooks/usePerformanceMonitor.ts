import { useEffect, useRef, useCallback } from 'react';

export interface PerformanceMetrics {
  fps: number;
  cpuLoad: number;
  memoryUsage: number;
  renderTime: number;
  timestamp: number;
}

export interface UsePerformanceMonitorProps {
  enabled: boolean;
  onMetrics?: (metrics: PerformanceMetrics) => void;
  interval?: number;
  warningThreshold?: number; // FPS threshold before warning (default: 30)
}

/**
 * Hook for monitoring rendering performance and resource usage.
 * Tracks FPS, CPU load estimation, memory usage, and frame render time.
 * 
 * @example
 * usePerformanceMonitor({
 *   enabled: isInitialized,
 *   onMetrics: (metrics) => console.log(`FPS: ${metrics.fps}`),
 *   interval: 1000,
 *   warningThreshold: 30
 * });
 */
export function usePerformanceMonitor({
  enabled,
  onMetrics,
  interval = 1000,
  warningThreshold = 30,
}: UsePerformanceMonitorProps) {
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const lastMetricsRef = useRef<PerformanceMetrics | null>(null);
  const rafRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const measureMetrics = useCallback(() => {
    const now = performance.now();
    const elapsed = now - lastTimeRef.current;
    const fps = Math.round((frameCountRef.current * 1000) / elapsed);

    frameCountRef.current = 0;
    lastTimeRef.current = now;

    // Estimate CPU load based on FPS (inverse relationship)
    // FPS 60 = 0% load, FPS 30 = 50% load, FPS 0 = 100% load
    const cpuLoad = Math.max(0, Math.min(1, 1 - fps / 60));

    // Get memory usage if available (Chrome/Edge)
    const memoryUsage =
      (performance as any).memory?.usedJSHeapSize /
        (performance as any).memory?.jsHeapSizeLimit || 0;

    const metrics: PerformanceMetrics = {
      fps,
      cpuLoad,
      memoryUsage,
      renderTime: elapsed / Math.max(frameCountRef.current, 1),
      timestamp: now,
    };

    lastMetricsRef.current = metrics;

    // Warn if FPS is low
    if (fps < warningThreshold && elapsed > 100) {
      console.warn(
        `[PERF WARNING] Low FPS detected: ${fps} (threshold: ${warningThreshold})`
      );
    }

    onMetrics?.(metrics);
  }, [onMetrics, warningThreshold]);

  const measureFrame = useCallback(() => {
    frameCountRef.current++;
    rafRef.current = requestAnimationFrame(measureFrame);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // Start measuring frames
    rafRef.current = requestAnimationFrame(measureFrame);

    // Collect metrics at specified interval
    intervalRef.current = setInterval(measureMetrics, interval);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, interval, measureMetrics, measureFrame]);

  // Expose current metrics
  return lastMetricsRef.current || { fps: 0, cpuLoad: 0, memoryUsage: 0, renderTime: 0, timestamp: 0 };
}
