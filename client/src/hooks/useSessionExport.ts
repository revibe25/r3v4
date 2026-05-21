import { useCallback } from 'react';

export interface ExportResult {
  blob: Blob;
  filename: string;
}

/**
 * Hook for exporting session data in multiple formats.
 * Supports JSON, WAV, and MIDI exports.
 * 
 * @example
 * const { exportToJson, exportToWav, exportToMidi } = useSessionExport(state, exportSession);
 * const result = await exportToJson('my-session');
 * const url = URL.createObjectURL(result.blob);
 */
export function useSessionExport(state: any, exportSession: () => string) {
  const exportToJson = useCallback(
    async (basename: string): Promise<ExportResult> => {
      const json = exportSession();
      const blob = new Blob([json], { type: 'application/json' });
      return {
        blob,
        filename: `${basename}.json`,
      };
    },
    [exportSession]
  );

  const exportToWav = useCallback(
    async (basename: string): Promise<ExportResult> => {
      try {
        // Create offline context for rendering
        const sampleRate = 44100;
        const duration = state.bpm ? (60 / state.bpm) * 16 : 16; // 16 bars or default
        const numberOfChannels = 2;
        const length = Math.ceil(sampleRate * duration);

        const offlineContext = new OfflineAudioContext(
          numberOfChannels,
          length,
          sampleRate
        );

        // Create a simple sine wave as placeholder
        // In production, you'd render actual session audio here
        const oscillator = offlineContext.createOscillator();
        const gainNode = offlineContext.createGain();

        oscillator.frequency.value = 440;
        gainNode.gain.setValueAtTime(0.3, 0);
        gainNode.gain.linearRampToValueAtTime(0, duration);

        oscillator.connect(gainNode);
        gainNode.connect(offlineContext.destination);

        oscillator.start(0);
        oscillator.stop(duration);

        const renderedBuffer = await offlineContext.startRendering();
        const blob = audioBufferToWav(renderedBuffer);

        return {
          blob,
          filename: `${basename}.wav`,
        };
      } catch (error) {
        console.error('WAV export failed:', error);
        throw error;
      }
    },
    [state.bpm]
  );

  const exportToMidi = useCallback(
    async (basename: string): Promise<ExportResult> => {
      try {
        // Simple MIDI export
        // Requires @tonejs/midi or equivalent
        const midi = createMidiFromEvents(
          state.recordedEvents || [],
          state.bpm || 120
        );

        const blob = new Blob([midi.toArray() as Uint8Array<ArrayBuffer>], { type: 'audio/midi' });
        return {
          blob,
          filename: `${basename}.mid`,
        };
      } catch (error) {
        console.error('MIDI export failed:', error);
        throw error;
      }
    },
    [state.recordedEvents, state.bpm]
  );

  return {
    exportToJson,
    exportToWav,
    exportToMidi,
  };
}

/**
 * Convert AudioBuffer to WAV Blob (PCM 16-bit)
 */
function audioBufferToWav(audioBuffer: AudioBuffer): Blob {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numberOfChannels * bytesPerSample;

  // Interleave channels
  let pos = 0;
  const interleaved = new Float32Array(audioBuffer.length * numberOfChannels);
  for (let i = 0; i < audioBuffer.length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      interleaved[pos++] = audioBuffer.getChannelData(channel)[i];
    }
  }

  const dataLength = interleaved.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  // Helper to write ASCII string
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  // WAV header
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, format, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataLength, true);

  // Convert float samples to 16-bit PCM
  let offset = 44;
  let index = 0;
  const volume = 0.8;

  while (offset < buffer.byteLength) {
    const s = Math.max(-1, Math.min(1, interleaved[index++] * volume));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Create MIDI data from recorded events
 * Returns a simple MIDI-like structure
 */
function createMidiFromEvents(
  events: any[],
  tempo: number
): { toArray: () => Uint8Array } {
  // Simplified MIDI creation
  // In production, use @tonejs/midi or similar

  const midiEvents: number[] = [];

  // MIDI header
  midiEvents.push(...'MThd'.split('').map(c => c.charCodeAt(0)));
  midiEvents.push(0, 0, 0, 6); // header length
  midiEvents.push(0, 0); // format 0
  midiEvents.push(0, 1); // 1 track
  midiEvents.push(0, 96); // 96 ticks per quarter note

  // Track header
  midiEvents.push(...'MTrk'.split('').map(c => c.charCodeAt(0)));
  const trackLengthPos = midiEvents.length;
  midiEvents.push(0, 0, 0, 0); // placeholder for track length

  const trackStart = midiEvents.length;

  // Tempo meta event
  const microsecondsPerBeat = Math.round((60 * 1000000) / tempo);
  midiEvents.push(0, 0xff, 0x51, 0x03);
  midiEvents.push(
    (microsecondsPerBeat >> 16) & 0xff,
    (microsecondsPerBeat >> 8) & 0xff,
    microsecondsPerBeat & 0xff
  );

  // Add note events
  events.forEach((event: any) => {
    if (event.type === 'noteOn') {
      const midi = event.midi || 60;
      const velocity = Math.round((event.velocity || 0.8) * 127);
      midiEvents.push(0, 0x90, midi, velocity); // Note on
    }
  });

  // End of track
  midiEvents.push(0, 0xff, 0x2f, 0x00);

  // Update track length
  const trackLength = midiEvents.length - trackStart;
  // Write track length as 4 big-endian bytes into the midiEvents array
  midiEvents[trackLengthPos]     = (trackLength >> 24) & 0xff;
  midiEvents[trackLengthPos + 1] = (trackLength >> 16) & 0xff;
  midiEvents[trackLengthPos + 2] = (trackLength >> 8)  & 0xff;
  midiEvents[trackLengthPos + 3] =  trackLength        & 0xff;

  return {
    toArray: () => new Uint8Array(midiEvents),
  };
}

let view: DataView; // Global for track length update
