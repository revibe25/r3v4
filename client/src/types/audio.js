// client/src/types/audio.ts
/**
 * Effect types supported by the system
 */
export var EffectType;
(function (EffectType) {
    EffectType["COMPRESSOR"] = "compressor";
    EffectType["EQ"] = "eq";
    EffectType["REVERB"] = "reverb";
    EffectType["DELAY"] = "delay";
    EffectType["DISTORTION"] = "distortion";
    EffectType["CHORUS"] = "chorus";
    EffectType["FLANGER"] = "flanger";
    EffectType["PHASER"] = "phaser";
    EffectType["FILTER"] = "filter";
    EffectType["LIMITER"] = "limiter";
    EffectType["GATE"] = "gate";
    EffectType["CUSTOM"] = "custom";
})(EffectType || (EffectType = {}));
/**
 * Parameter value types
 */
export var ParameterType;
(function (ParameterType) {
    ParameterType["FLOAT"] = "float";
    ParameterType["INT"] = "int";
    ParameterType["BOOLEAN"] = "boolean";
    ParameterType["ENUM"] = "enum";
})(ParameterType || (ParameterType = {}));
/**
 * Automation curve types
 */
export var AutomationCurve;
(function (AutomationCurve) {
    AutomationCurve["LINEAR"] = "linear";
    AutomationCurve["EXPONENTIAL"] = "exponential";
    AutomationCurve["LOGARITHMIC"] = "logarithmic";
    AutomationCurve["STEP"] = "step";
    AutomationCurve["SMOOTH"] = "smooth";
})(AutomationCurve || (AutomationCurve = {}));
// ============================================
// TRANSPORT TYPES
// ============================================
/**
 * Transport state
 */
export var TransportState;
(function (TransportState) {
    TransportState["STOPPED"] = "stopped";
    TransportState["PLAYING"] = "playing";
    TransportState["PAUSED"] = "paused";
    TransportState["RECORDING"] = "recording";
})(TransportState || (TransportState = {}));
// ============================================
// TYPE GUARDS
// ============================================
/**
 * Type guard for MIDI note events
 */
export function isMIDINoteEvent(msg) {
    return msg.type === 'noteOn' || msg.type === 'noteOff';
}
/**
 * Type guard for MIDI control events
 */
export function isMIDIControlEvent(msg) {
    return msg.type === 'controlChange';
}
/**
 * Type guard for AudioEffect
 */
export function isAudioEffect(obj) {
    return (obj &&
        typeof obj.id === 'string' &&
        typeof obj.connect === 'function' &&
        typeof obj.disconnect === 'function' &&
        typeof obj.dispose === 'function');
}
// ============================================
// CONSTANTS
// ============================================
/**
 * Default buffer sizes (power of 2)
 */
export const BUFFER_SIZES = [128, 256, 512, 1024, 2048, 4096, 8192];
/**
 * Standard sample rates
 */
export const SAMPLE_RATES = [44100, 48000, 88200, 96000, 176400, 192000];
/**
 * Default performance thresholds
 */
export const PERFORMANCE_THRESHOLDS = {
    CPU_WARNING: 70,
    CPU_CRITICAL: 85,
    MEMORY_WARNING: 75,
    MEMORY_CRITICAL: 90,
    MAX_LATENCY: 50, // ms
};
/**
 * MIDI note names
 */
export const MIDI_NOTE_NAMES = [
    'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'
];
/**
 * Project version for compatibility checking
 */
export const PROJECT_VERSION = '1.0.0';
export { MixerChannel } from '@/audio/mixer/mixer-channel';
