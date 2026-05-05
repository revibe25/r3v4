import { useState } from 'react';
import { AudioEngine } from '../engine/AudioEngine';

export function useAudioEngine() {
  const [engine] = useState(() => new AudioEngine());
  const [ready, setReady] = useState(false);
  const [energy, setEnergy] = useState(0);

  const start = async () => {
    await engine.init();

    engine.getVIL().subscribe((data: any) => {
      setEnergy(data.energy ?? 0);
    });

    setReady(true);
  };

  return { start, ready, energy };
}
