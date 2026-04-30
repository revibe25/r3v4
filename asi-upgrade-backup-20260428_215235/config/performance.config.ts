// src/config/performance.config.ts
// Global Performance Configuration
// Adjust these values based on your system capabilities

export const PERFORMANCE_CONFIG = {
  // ==========================================
  // VISUAL UPDATE RATES
  // ==========================================
  VISUALIZER_FPS: 30,        // Visualizer frame rate (was 60fps)
  METER_UPDATE_MS: 33,       // Meter update interval in ms (~30Hz, was 48kHz)
  SPECTRUM_FPS: 24,          // Spectrum analyzer frame rate
  WAVEFORM_FPS: 30,          // Waveform display frame rate
  
  // ==========================================
  // AUDIO ANALYSIS SETTINGS
  // ==========================================
  FFT_SIZE: 512,             // FFT size for frequency analysis (was 2048)
  ANALYSER_SMOOTHING: 0.7,   // Smoothing constant (0-1)
  METER_FFT_SIZE: 512,       // Meter-specific FFT size
  
  // ==========================================
  // OPTIMIZATION FEATURES
  // ==========================================
  AUTO_BYPASS_ENABLED: true,      // Auto-bypass inactive effects
  SILENCE_DETECTION: true,        // Skip processing silent signals
  NODE_POOLING: true,             // Reuse audio nodes
  GRADIENT_CACHING: true,         // Cache canvas gradients
  VISIBILITY_DETECTION: true,     // Pause hidden visualizers
  LAZY_RENDERING: true,           // Skip rendering below threshold
  
  // ==========================================
  // PERFORMANCE THRESHOLDS
  // ==========================================
  SILENCE_THRESHOLD_DB: -60,      // Threshold for silence detection
  BYPASS_THRESHOLD_DB: -65,       // Threshold for auto-bypass
  MIN_RENDER_THRESHOLD: 0.01,     // Skip rendering below this value
  PEAK_HOLD_SAMPLES: 15,          // Samples to hold peak value
  
  // ==========================================
  // RESOURCE LIMITS
  // ==========================================
  MAX_FX_PER_CHAIN: 8,            // Maximum effects per chain
  MAX_ACTIVE_TRACKS: 16,          // Maximum simultaneous tracks
  PARTICLE_POOL_SIZE: 100,        // Particle system pool size
  NODE_POOL_MAX_SIZE: 50,         // Audio node pool size
  MAX_HISTORY_LENGTH: 100,        // Performance history entries
  
  // ==========================================
  // VISUAL QUALITY SETTINGS
  // ==========================================
  CANVAS_DPR_MAX: 2,              // Cap device pixel ratio (retina displays)
  BAR_COUNT: 48,                  // Spectrum/visualizer bar count (was 64)
  WAVEFORM_RESOLUTION: 200,       // Waveform points to render
  DOWNSAMPLE_FACTOR: 4,           // Data downsampling factor
  
  // ==========================================
  // UPDATE INTERVALS
  // ==========================================
  SILENCE_CHECK_INTERVAL: 100,    // Silence detection check interval (ms)
  PERFORMANCE_UPDATE_INTERVAL: 1000, // Performance metrics update (ms)
  GRAPH_OPTIMIZE_INTERVAL: 100,   // Audio graph optimization interval (ms)
  LEVEL_UPDATE_INTERVAL: 50,      // Level meter update interval (ms)
  
  // ==========================================
  // FEATURE TOGGLES (can be changed at runtime)
  // ==========================================
  ENABLE_VISUALIZERS: true,
  ENABLE_SPECTRUM: true,
  ENABLE_METERS: true,
  ENABLE_WAVEFORMS: true,
  ENABLE_PARTICLES: true,
  
  // ==========================================
  // QUALITY PRESETS
  // ==========================================
  QUALITY_PRESET: 'medium' as QualityPreset,
};

export type QualityPreset = 'low' | 'medium' | 'high' | 'ultra';

export const QUALITY_PRESETS: Record<QualityPreset, Partial<typeof PERFORMANCE_CONFIG>> = {
  low: {
    VISUALIZER_FPS: 20,
    SPECTRUM_FPS: 20,
    FFT_SIZE: 256,
    BAR_COUNT: 24,
    CANVAS_DPR_MAX: 1,
    WAVEFORM_RESOLUTION: 100,
    PARTICLE_POOL_SIZE: 50,
  },
  
  medium: {
    VISUALIZER_FPS: 30,
    SPECTRUM_FPS: 24,
    FFT_SIZE: 512,
    BAR_COUNT: 32,
    CANVAS_DPR_MAX: 1.5,
    WAVEFORM_RESOLUTION: 200,
    PARTICLE_POOL_SIZE: 100,
  },
  
  high: {
    VISUALIZER_FPS: 30,
    SPECTRUM_FPS: 30,
    FFT_SIZE: 512,
    BAR_COUNT: 48,
    CANVAS_DPR_MAX: 2,
    WAVEFORM_RESOLUTION: 300,
    PARTICLE_POOL_SIZE: 150,
  },
  
  ultra: {
    VISUALIZER_FPS: 60,
    SPECTRUM_FPS: 60,
    FFT_SIZE: 1024,
    BAR_COUNT: 64,
    CANVAS_DPR_MAX: 2,
    WAVEFORM_RESOLUTION: 500,
    PARTICLE_POOL_SIZE: 200,
  },
};

/**
 * Apply a quality preset
 */
export function applyQualityPreset(preset: QualityPreset): void {
  const presetConfig = QUALITY_PRESETS[preset];
  Object.assign(PERFORMANCE_CONFIG, presetConfig);
  PERFORMANCE_CONFIG.QUALITY_PRESET = preset;
}

/**
 * Auto-detect optimal settings based on device
 */
export function autoDetectPerformanceSettings(): void {
  // Check device capabilities
  const cpuCores = navigator.hardwareConcurrency || 4;
  const memory = (performance as any).memory?.jsHeapSizeLimit || 0;
  const isMobile = /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent);
  
  let preset: QualityPreset = 'medium';
  
  if (isMobile || cpuCores <= 2) {
    preset = 'low';
  } else if (cpuCores <= 4 || memory < 2e9) {
    preset = 'medium';
  } else if (cpuCores <= 8) {
    preset = 'high';
  } else {
    preset = 'ultra';
  }
  
  console.log(`[Performance] Auto-detected preset: ${preset}`);
  console.log(`[Performance] CPU cores: ${cpuCores}, Mobile: ${isMobile}`);
  
  applyQualityPreset(preset);
}

/**
 * Get current configuration
 */
export function getPerformanceConfig() {
  return { ...PERFORMANCE_CONFIG };
}

/**
 * Update specific config values
 */
export function updatePerformanceConfig(updates: Partial<typeof PERFORMANCE_CONFIG>): void {
  Object.assign(PERFORMANCE_CONFIG, updates);
}

/**
 * Reset to default configuration
 */
export function resetPerformanceConfig(): void {
  applyQualityPreset('medium');
}

// Auto-detect on module load (can be disabled)
if (typeof window !== 'undefined') {
  // Uncomment to auto-detect on load:
  // autoDetectPerformanceSettings();
}