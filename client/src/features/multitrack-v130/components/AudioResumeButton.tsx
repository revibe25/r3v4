import React from 'react';
import { ensureAudioRunning } from '@/audio/core/audio-context';

export const AudioResumeButton = () => {
  const handleResume = async () => {
    try {
      await ensureAudioRunning();
      console.log('[AudioResumeButton] Audio engine resumed');
    } catch (err) {
      console.error('[AudioResumeButton] Failed to resume audio:', err);
    }
  };

  return (
    <button
      onClick={handleResume}
      title="Resume audio engine (browser autoplay policy)"
      style={{
        padding: '6px 10px',
        backgroundColor: '#00ff00',
        color: '#000',
        border: 'none',
        borderRadius: '3px',
        fontWeight: '600',
        cursor: 'pointer',
        fontSize: '11px',
        marginLeft: '8px',
      }}
    >
      🎵 Resume
    </button>
  );
};

export default AudioResumeButton;
