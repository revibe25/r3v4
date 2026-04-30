import MultitrackView                          from './components/multi-track-view';
import type { Track as ViewTrack }             from './components/multi-track-view';
import { useDAWStore }                         from './hooks/useDAWStore';
import type { Track as StoreTrack }            from './hooks/useDAWStore';

const FX_TYPE_MAP: Record<string, ViewTrack['fxChain'][number]> = {
  eq:         'EQ',
  compressor: 'Compressor',
  reverb:     'Reverb',
  delay:      'Delay',
  filter:     'EQ',
  distortion: 'Saturation',
};

/** Pure adapter: StoreTrack → ViewTrack. No side effects. */
function adaptTrack(t: StoreTrack): ViewTrack {
  return {
    id:      t.id,
    name:    t.label,
    armed:   t.armed,
    muted:   t.mute,
    solo:    t.solo,
    volume:  t.gain,
    pan:     t.pan,
    input:   t.inputSource ?? '',
    fxChain: t.fxChain.map(fx => FX_TYPE_MAP[fx.type] ?? 'EQ'),
    meter:   undefined,
    color:   t.color,
    locked:  false,
    hidden:  false,
    groupId: undefined,
  };
}

function MultitrackViewWrapper() {
  const {
    tracks, playing, recording, position,
    setPlaying, setRecording, updateTrack, removeTrack, addTrack,
  } = useDAWStore();

  return (
    <MultitrackView
      tracks={tracks.map(adaptTrack)}
      transport={{ isPlaying: playing, isRecording: recording, position }}
      hideTransport={true}
      onTogglePlay={()    => setPlaying(!playing)}
      onToggleRecord={()  => setRecording(!recording)}
      onArmTrack={(id)    => updateTrack(id, { armed: !tracks.find(t => t.id === id)?.armed })}
      onToggleMute={(id)  => updateTrack(id, { mute:  !tracks.find(t => t.id === id)?.mute  })}
      onToggleSolo={(id)  => updateTrack(id, { solo:  !tracks.find(t => t.id === id)?.solo  })}
      onUpdateTrack={(id, data) => {
        const patch: Partial<StoreTrack> = {};
        if (data.name   !== undefined) patch.label       = data.name;
        if (data.volume !== undefined) patch.gain        = data.volume;
        if (data.muted  !== undefined) patch.mute        = data.muted;
        if (data.armed  !== undefined) patch.armed       = data.armed;
        if (data.solo   !== undefined) patch.solo        = data.solo;
        if (data.pan    !== undefined) patch.pan         = data.pan;
        if (data.input  !== undefined) patch.inputSource = data.input;
        updateTrack(id, patch);
      }}
      onDeleteTrack={(id)    => removeTrack(id)}
      onDuplicateTrack={(id) => {
        const src = tracks.find(t => t.id === id);
        if (src) addTrack({ ...src, label: `${src.label} (copy)` });
      }}
    />
  );
}

export default MultitrackViewWrapper;
