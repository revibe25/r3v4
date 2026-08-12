export class VSTPerformanceMonitor {
    start() { this.isMonitoring = true; }
    stop() { this.isMonitoring = false; }
    getCurrentSnapshot() { return {}; }
    getHistory(_limit) { return []; }
    clearHistory() { }
    getAverageLoad() { return 0; }
    getPeakLoad() { return 0; }
    onOverload(_cb) { }
    constructor(audioContext) {
        // ── PerformanceMonitor interface stubs ────────────────────
        this.isMonitoring = false;
        // ───────────────────────────────────────────────────────────
        this.metrics = new Map();
        this.measurementWindow = 100; // Number of samples to average
        this.measurements = new Map();
        this.monitoringInterval = null;
        this.audioContext = audioContext;
    }
    /**
     * Start monitoring a VST
     */
    startMonitoring(vstId) {
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
    stopMonitoring(vstId) {
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
    recordProcessingTime(vstId, timeMs) {
        const measurements = this.measurements.get(vstId);
        if (!measurements)
            return;
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
    getMetrics(vstId) {
        return this.metrics.get(vstId) || null;
    }
    /**
     * Get all metrics
     */
    getAllMetrics() {
        return new Map(this.metrics);
    }
    /**
     * Get total system CPU usage
     */
    getTotalCPUUsage() {
        let total = 0;
        this.metrics.forEach(m => {
            total += m.cpuUsage;
        });
        return total;
    }
    /**
     * Get optimization recommendations
     */
    getOptimizationRecommendations(vstId) {
        const metrics = this.metrics.get(vstId);
        if (!metrics)
            return [];
        const recommendations = [];
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
    updateMetrics() {
        // Update memory usage (if available)
        if ('memory' in performance && performance.memory) {
            const memory = performance.memory;
            const usedMB = memory.usedJSHeapSize / 1024 / 1024;
            this.metrics.forEach(metrics => {
                metrics.memoryUsage = usedMB;
            });
        }
    }
    calculateAverage(values) {
        if (values.length === 0)
            return 0;
        const sum = values.reduce((a, b) => a + b, 0);
        return sum / values.length;
    }
    /**
     * Dispose monitor
     */
    dispose() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        this.metrics.clear();
        this.measurements.clear();
    }
}
// Wrap VST processing with performance monitoring
export function wrapWithPerformanceMonitoring(vstNode, monitor, vstId) {
    const originalProcess = vstNode.process;
    vstNode.process = function (...args) {
        const startTime = performance.now();
        const result = originalProcess.apply(this, args);
        const endTime = performance.now();
        monitor.recordProcessingTime(vstId, endTime - startTime);
        return result;
    };
}
