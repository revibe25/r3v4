// client/src/utils/audio-utils.ts

export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

export function gainToDb(gain: number): number {
  return 20 * Math.log10(gain);
}

export function clamp(
  value: number,
  min: number,
  max: number
): number {
  return Math.min(Math.max(value, min), max);
}

export function smoothParam(
  param: AudioParam,
  value: number,
  time: number,
  smoothing = 0.01
) {
  param.setTargetAtTime(value, time, smoothing);
}
