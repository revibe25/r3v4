/**
 * server/services/audio-analysis.ts
 *
 * Wires @llpte/llpte-signal into the Express audio analyze route.
 *
 * The analyzer runs in a worker_thread to keep the event loop free.
 * A 4-second 44100Hz buffer completes in < 2000ms per the package SLA.
 *
 * Decoding pipeline:
 *   multer -> disk -> fs.readFile -> AudioBuffer (via node-web-audio-api)
 *   -> analyzeBuffer -> JSON response -> unlink temp file
 *
 * Install required peer dep if not present:
 *   cd server && pnpm add node-web-audio-api
 */

import fs from 'fs/promises';
import { analyzeAudio } from '@llpte/llpte-signal';

// node-web-audio-api provides a Node.js AudioContext compatible with
// the Web Audio API spec. It can decode audio files to PCM buffers.
// If this import fails, run: cd server && pnpm add node-web-audio-api
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let AudioContext: any = null;  // typed any: node-web-audio-api ships no .d.ts
try {
   
  ({ AudioContext } = require('node-web-audio-api'));
} catch {
  AudioContext = null;
}

import type { AnalysisResult as LlpteResult } from '@llpte/llpte-signal';

export interface AnalysisResult extends LlpteResult {
  duration: number;
}

/**
 * Decode an audio file and run the full llpte-signal analysis pipeline.
 * @param filePath - Absolute path to the uploaded audio file.
 * @returns AnalysisResult or throws if decoding or analysis fails.
 */
export async function analyzeAudioFile(filePath: string): Promise<AnalysisResult> {
  if (!AudioContext) {
    throw new Error(
      'node-web-audio-api is not installed. Run: cd server && pnpm add node-web-audio-api'
    );
  }

  const raw  = await fs.readFile(filePath);
  const ctx  = new AudioContext();

  // decodeAudioData returns a Web Audio AudioBuffer
  const audioBuffer = await ctx.decodeAudioData(raw.buffer as ArrayBuffer);

  const channelData: Float32Array[] = [];
  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
    channelData.push(audioBuffer.getChannelData(ch));
  }

  const result = await analyzeAudio({
    channelData,
    sampleRate: audioBuffer.sampleRate,
    duration:   audioBuffer.duration,
  });

  await ctx.close();

  // duration is already in result from analyzeAudio
  return result as AnalysisResult & { duration: number };
}
