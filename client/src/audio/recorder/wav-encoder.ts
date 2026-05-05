// client/src/audio/recorder/wav-encoder.ts

import audioBufferToWav from "audiobuffer-to-wav";

export function encodeWav(
  buffers: Float32Array[],
  sampleRate: number
): Blob {
  const length = buffers.reduce(
    (sum, b) => sum + b.length,
    0
  );

  const audioBuffer = new AudioBuffer({
    length,
    sampleRate,
    numberOfChannels: 1,
  });

  const channelData = audioBuffer.getChannelData(0);

  let offset = 0;
  for (const buffer of buffers) {
    channelData.set(buffer, offset);
    offset += buffer.length;
  }

  const wav = audioBufferToWav(audioBuffer);
  return new Blob([wav], { type: "audio/wav" });
}
