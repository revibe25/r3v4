// shared/types/transport.types.ts

export type TransportState = {
  playing: boolean;
  recording: boolean;

  bpm: number;

  position: number; // seconds
  loop: boolean;
  loopStart: number;
  loopEnd: number;
};
