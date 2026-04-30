import { useMixerStore } from '@/store/mixer-store';
import "@/store/mixer-store"
import { MixerStrip } from "./mixer-strip";

export function MixerView() {
  const channels = useMixerStore(state =>
    Object.keys(state.channels)
  );

  return (
    <div style={{ display: "flex", gap: 12 }}>
      {channels.map(id => (
        <MixerStrip key={id} id={id} />
      ))}
    </div>
  );
}
