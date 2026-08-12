import { useEffect, useState } from 'react';
/**
 * Custom hook to integrate waveform editor with existing AudioEngine
 * Falls back to creating a local context if AudioEngine is unavailable
 */
export const useWaveformAudioEngine = () => {
    const [audioContext, setAudioContext] = useState(null);
    useEffect(() => {
        // Try to use existing AudioContext from your AudioEngine
        // If not available, create a new one for the waveform editor
        const initAudioContext = async () => {
            try {
                // Check if AudioContext already exists globally (from your AudioEngine)
                const existingContext = window.__audioContext;
                if (existingContext) {
                    setAudioContext(existingContext);
                }
                else {
                    // Create new AudioContext for standalone usage
                    const ctx = new (window.AudioContext || window.webkitAudioContext)();
                    setAudioContext(ctx);
                    // Store globally for potential reuse
                    window.__audioContext = ctx;
                }
            }
            catch (error) {
                console.error('Failed to initialize audio context:', error);
            }
        };
        initAudioContext();
    }, []);
    const loadAudioFile = async (file) => {
        if (!audioContext) {
            console.error('AudioContext not initialized');
            return null;
        }
        try {
            const arrayBuffer = await file.arrayBuffer();
            return await audioContext.decodeAudioData(arrayBuffer);
        }
        catch (error) {
            console.error('Failed to load audio file:', error);
            return null;
        }
    };
    const generateWaveformData = (audioBuffer, samples = 200) => {
        const rawData = audioBuffer.getChannelData(0);
        const blockSize = Math.floor(rawData.length / samples);
        const waveform = [];
        for (let i = 0; i < samples; i++) {
            let sum = 0;
            for (let j = 0; j < blockSize; j++) {
                sum += Math.abs(rawData[i * blockSize + j] || 0);
            }
            waveform.push(sum / blockSize);
        }
        return waveform;
    };
    return {
        audioContext,
        loadAudioFile,
        generateWaveformData,
    };
};
