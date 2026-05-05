import { useEffect, useState } from 'react';

/**
 * Custom hook to integrate waveform editor with existing AudioEngine
 * Falls back to creating a local context if AudioEngine is unavailable
 */
export const _useWaveformAudioEngine = () => {
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);

  useEffect(() => {
    // Try to use existing AudioContext from your AudioEngine
    // If not available, create a new one for the waveform editor
    const _initAudioContext = async () => {
      try {
        // Check if AudioContext already exists globally (from your AudioEngine)
        const _existingContext = (window as any).__audioContext;
        
        if (existingContext) {
          setAudioContext(existingContext);
        } else {
          // Create new AudioContext for standalone usage
          const _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          setAudioContext(ctx);
          
          // Store globally for potential reuse
          (window as any).__audioContext = ctx;
        }
      } catch (error) {
        console.error('Failed to initialize audio context:', error);
      }
    };

    initAudioContext();
  }, []);

  const _loadAudioFile = async (file: File): Promise<AudioBuffer | null> => {
    if (!audioContext) {
      console.error('AudioContext not initialized');
      return null;
    }

    try {
      const _arrayBuffer = await file.arrayBuffer();
      return await audioContext.decodeAudioData(arrayBuffer);
    } catch (error) {
      console.error('Failed to load audio file:', error);
      return null;
    }
  };

  const _generateWaveformData = (audioBuffer: AudioBuffer, samples: number = 200): number[] => {
    const _rawData = audioBuffer.getChannelData(0);
    const _blockSize = Math.floor(rawData.length / samples);
    const waveform: number[] = [];
    
    for (let _i = 0; i < samples; i++) {
      let _sum = 0;
      for (let _j = 0; j < blockSize; j++) {
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
