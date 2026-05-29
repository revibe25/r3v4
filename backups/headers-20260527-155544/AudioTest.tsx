import { useAudioEngine } from '../audio/hooks/useAudioEngine';

export default function AudioTest() {
  const { start, ready, energy } = useAudioEngine();

  if (!ready) {
    return (
      <div style={{ padding: 20 }}>
        <button onClick={start}>Start Audio</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Audio Engine Running</h2>
      <p>Energy: {energy.toFixed(4)}</p>
    </div>
  );
}
