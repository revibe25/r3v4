/** Raw audio buffer data passed to the analyzer */
export interface RawAudioBuffer {
  sampleRate:  number;
  channelData: Float32Array[];
  duration:    number;
  /** Source file path or URL for cache keying */
  sourceId?:   string;
}

/** Full analysis result for a single track */
export interface AnalysisResult {
  bpm:              number;
  bpmConfidence:    number;   // 0.0–1.0
  key:              string;   // Camelot notation
  keyConfidence:    number;   // 0.0–1.0
  energy:           number;   // 0.0–1.0
  spectralCentroid: number;   // Hz
  rmsLoudness:      number;   // 0.0–1.0
  dynamicRange:     number;   // dB
  analysisTimeMs:   number;   // target < 2000ms
}
