// client/src/audio/recorder/wav-encoder.ts

import audioBufferToWav from "audiobuffer-to-wav";

export function encodeWav(
  buffers: Float32Array[],
  sampleRate: number
): Blob {
  const _length = buffers.reduce(
    (sum, b) => sum + b.length,
    0
  );

  const _audioBuffer = new AudioBuffer({
    length,
    sampleRate,
    numberOfChannels: 1,
  });

  const _channelData = audioBuffer.getChannelData(0);

  let _offset = 0;
  for (const buffer of buffers) {
    channelData.set(buffer, offset);
    offset += buffer.length;
  }

  const _wav = audioBufferToWav(audioBuffer);
  return new Blob([wav], { type: "audio/wav" });
}
