import { useEffect } from 'react';
import { useAudioEngine } from '@/hooks/use-audio-engine';
import { useTheme } from '@/components/theme-provider';
import { DrumPads } from '@/components/drum-pads';
import { PianoKeys } from '@/components/piano-keys';
import { FXPanel } from '@/components/fx-panel';
import { DJControls } from '@/components/dj-controls';
import { TransportControls } from '@/components/transport-controls';
import { AudioVisualizer } from '@/components/audio-visualizer';
import { WaveformEditor } from '@/components/waveform-editor';
import { HeaderControls } from '@/components/header-controls';
import { Card } from '@/components/ui/card';

export default function InstrumentPage() {
  const { theme, setTheme } = useTheme();
  const {
    state,
    isInitialized,
    init,
    triggerPad,
    triggerKey,
    toggleFX,
    setFilter,
    setPitch,
    setCrossfade,
    setBpm,
    toggleMetronome,
    arm,
    record,
    stop,
    play,
    undo,
    redo,
    getAnalyserData,
    getWaveformData,
    loadSample,
    assignPadSample,
    assignKeySample,
    exportSession,
    importSession,
  } = useAudioEngine();

  useEffect(() => {
    const handleClick = () => {
      if (!isInitialized) {
        init();
      }
    };
    window.addEventListener('click', handleClick, { once: true });
    window.addEventListener('keydown', handleClick, { once: true });
    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleClick);
    };
  }, [isInitialized, init]);

  const handleSave = () => {
    const json = exportSession();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `r3vibe-session-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = () => {
    handleSave();
  };

  return (
    <div className="min-h-screen studio-bg p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <Card className="bg-card/90 backdrop-blur-sm border-border/40 shadow-2xl shadow-black/30 p-4 md:p-6">
          <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <h1 className="text-xl md:text-2xl font-bold text-primary tracking-tight" data-testid="text-title">
              R3VIBE Native
              <span className="text-sm md:text-base font-normal text-muted-foreground ml-2">
                16 Pad + Piano Octave
              </span>
            </h1>
            <HeaderControls
              theme={theme}
              onThemeChange={setTheme}
              bpm={state.bpm}
              onBpmChange={setBpm}
              metronomeOn={state.metronomeOn}
              onMetronomeToggle={toggleMetronome}
              onSave={handleSave}
              onLoad={importSession}
            />
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-4 md:gap-6">
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-muted/20 border border-border/30">
                <DrumPads
                  pads={state.pads}
                  onTrigger={triggerPad}
                  onAssignSample={assignPadSample}
                  loadSample={loadSample}
                />
              </div>

              <div className="p-4 rounded-xl bg-muted/20 border border-border/30">
                <PianoKeys
                  keys={state.keys}
                  onTrigger={triggerKey}
                  onAssignSample={assignKeySample}
                  loadSample={loadSample}
                />
              </div>

              <div className="p-4 rounded-xl bg-muted/20 border border-border/30">
                <WaveformEditor
                  getWaveformData={getWaveformData}
                  isInitialized={isInitialized}
                />
              </div>
            </div>

            <aside className="space-y-4">
              <div className="p-4 rounded-xl bg-muted/20 border border-border/30">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  Mixer, Recorder & FX
                </h3>
                
                <AudioVisualizer
                  getAnalyserData={getAnalyserData}
                  isInitialized={isInitialized}
                />

                <div className="mt-4">
                  <TransportControls
                    isArmed={state.isArmed}
                    isRecording={state.isRecording}
                    isPlaying={state.isPlaying}
                    recordedEventsCount={state.recordedEvents.length}
                    onArm={arm}
                    onRecord={record}
                    onStop={stop}
                    onPlay={play}
                    onUndo={undo}
                    onRedo={redo}
                    onExport={handleExport}
                  />
                </div>
              </div>

              <FXPanel fx={state.fx} onToggle={toggleFX} />

              <DJControls
                filterVal={state.filterVal}
                pitchSemitones={state.pitchSemitones}
                crossfade={state.crossfade}
                onFilterChange={setFilter}
                onPitchChange={setPitch}
                onCrossfadeChange={setCrossfade}
              />

              <div className="p-4 rounded-lg bg-card/30 border border-border/20 text-xs text-muted-foreground">
                <p className="font-medium mb-1">Quick Start:</p>
                <p>Click or use keyboard shortcuts (QWERTY for pads, ZSXDC for piano). Upload custom samples. Arm and record your performance.</p>
              </div>
            </aside>
          </div>

          <footer className="mt-6 flex flex-col md:flex-row md:justify-between gap-2 text-xs text-muted-foreground p-3 rounded-lg bg-muted/10 border border-border/20">
            <div data-testid="text-features">
              Polyphony / Accessible / Mobile-friendly / Offline-first
            </div>
            <div className="opacity-70" data-testid="text-tech">
              Made with Web Audio API, Web MIDI API & IndexedDB
            </div>
          </footer>
        </Card>

        {!isInitialized && (
          <div className="fixed inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-50">
            <Card className="p-8 text-center max-w-md mx-4">
              <h2 className="text-xl font-semibold mb-3">Click to Start</h2>
              <p className="text-muted-foreground mb-4">
                Click anywhere or press any key to initialize the audio engine.
              </p>
              <div className="animate-pulse text-primary text-4xl">
                <span className="inline-block">Click</span>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
