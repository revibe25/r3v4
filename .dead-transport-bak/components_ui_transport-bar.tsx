import { useTransportStore } from '@/store/transport-store';
import "@/store/clip-store"

export function TransportBar() {
  const {
    playing,
    recording,
    bpm,
    play,
    stop,
    record,
    setBpm,
  } = useTransportStore();

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button onClick={play}>▶</button>
      <button onClick={stop}>■</button>
      <button onClick={record}>
        {recording ? "● REC" : "REC"}
      </button>

      <label>
        BPM
        <input
          type="number"
          value={bpm}
          onChange={e => setBpm(+e.target.value)}
          style={{ width: 60 }}
        />
      </label>
    </div>
  );
}
