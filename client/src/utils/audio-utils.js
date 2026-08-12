// client/src/utils/audio-utils.ts
export function dbToGain(db) {
    return Math.pow(10, db / 20);
}
export function gainToDb(gain) {
    return 20 * Math.log10(gain);
}
export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
export function smoothParam(param, value, time, smoothing = 0.01) {
    param.setTargetAtTime(value, time, smoothing);
}
