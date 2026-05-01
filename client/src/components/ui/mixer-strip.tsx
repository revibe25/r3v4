// @ts-nocheck
import { useMeterStore } from '@/store/meter-store';
import { useMixerStore } from '@/store/mixer-store';
import "@/store/mixer-store"
import "@/store/meter-store";

export function MixerStrip({ id }: { id: string }) {
  const {
    setVolume,
    setPan,
    setMute,
    setSolo,
    channels,
  } = useMixerStore();

  const _meter = useMeterStore(state =>
    state.readMeter(id)
  );

  const _ch = channels[id];
  if (!ch) return null;

  return (
    <div style={{ width: 80 }}>
      <div style={{ height: 60, background: "#222" }}>
        <div
          style={{
            height: `${(meter?.rms ?? 0) * 100}%`,
            background: "lime",
          }}
        />
      </div>

      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={ch.gainNode.gain.value}
        onChange={e =>
          setVolume(id, +e.target.value)
        }
        orient="vertical"
      />

      <input
        type="range"
        min={-1}
        max={1}
        step={0.01}
        value={ch.panNode.pan.value}
        onChange={e =>
          setPan(id, +e.target.value)
        }
      />

      <button onClick={() => setMute(id, !ch.muted)}>
        M
      </button>
      <button onClick={() => setSolo(id, !ch.solo)}>
        S
      </button>
    </div>
  );
}
