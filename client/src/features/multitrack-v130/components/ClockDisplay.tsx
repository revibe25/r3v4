import React, { useEffect, useState } from 'react';
import styles from './ClockDisplay.module.css';

interface ClockDisplayProps {
  currentTime?: number; // seconds
  bpm?: number;
  timeSignature?: { numerator: number; denominator: number };
}

/**
 * Clock Display with Bar/Beat/Tick
 * Shows: 00:00:00.000 format + Bar 1 · Beat 1 · Tick 000
 * Updates at 60Hz to stay in sync with playhead
 */
export const ClockDisplay: React.FC<ClockDisplayProps> = ({ 
  currentTime = 0, 
  bpm = 120, 
  timeSignature = { numerator: 4, denominator: 4 }
}) => {
  const [display, setDisplay] = useState({ 
    time: '00:00:00.000', 
    bar: 1, 
    beat: 1, 
    tick: 0 
  });

  useEffect(() => {
    // Calculate bar/beat/tick from time
    const ticksPerBeat = 120; // MIDI standard (ticks per quarter note)
    const beatsPerBar = timeSignature.numerator;
    const secondsPerBeat = 60 / bpm;
    
    const totalBeats = currentTime / secondsPerBeat;
    const totalTicks = Math.round(totalBeats * ticksPerBeat);
    
    const beats = Math.floor(totalBeats);
    const bar = Math.floor(beats / beatsPerBar) + 1;
    const beat = (beats % beatsPerBar) + 1;
    const tick = totalTicks % ticksPerBeat;
    
    // Format time as HH:MM:SS.mmm
    const hours = Math.floor(currentTime / 3600);
    const minutes = Math.floor((currentTime % 3600) / 60);
    const seconds = Math.floor(currentTime % 60);
    const millis = Math.floor((currentTime % 1) * 1000);
    
    const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
    
    setDisplay({
      time: timeStr,
      bar,
      beat,
      tick: Math.floor(tick)
    });
  }, [currentTime, bpm, timeSignature]);

  return (
    <div className={styles.clock} role="region" aria-label="Clock display">
      <output className={styles.timeDisplay} id="tTime">
        {display.time}
      </output>
      <div className={styles.barBeatTick}>
        <span>Bar <b id="tBar" className={styles.barValue}>{display.bar}</b></span>
        <span>Beat <b id="tBeat" className={styles.beatValue}>{display.beat}</b></span>
        <span>Tick <b id="tTick" className={styles.tickValue}>{String(display.tick).padStart(3, '0')}</b></span>
      </div>
    </div>
  );
};

export default ClockDisplay;
