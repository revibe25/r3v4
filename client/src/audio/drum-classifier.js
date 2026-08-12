// client/src/audio/drum-classifier.ts
// ML drum classification stubbed - TF.js not installed.
// Replace with @tensorflow/tfjs import + real model when ready.
export class DrumClassifier {
    async load(_modelUrl) {
        console.warn('DrumClassifier: ML model not loaded (TF.js stub)');
    }
    classify(_spectrumData) {
        return { kick: 0, snare: 0, hihat: 0, tom: 0, clap: 0, percussion: 0 };
    }
    dispose() { }
}
export const drumClassifier = new DrumClassifier();
