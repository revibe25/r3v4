import { useEffect, useCallback } from 'react';
import { MicrophoneInput } from '@/components/microphone-input';
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

  // Initialize audio engine on user interaction
  useEffect(() => {
    const handleClick = () => {
      if (!isInitialized) {
        init();
      }
    };

    const handleKeyDown = () => {
      if (!isInitialized) {
        init();
      }
    };

    window.addEventListener('click', handleClick, { once: true });
    window.addEventListener('keydown', handleKeyDown, { once: true });

    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isInitialized, init]);

  // Handle session save
  const handleSave = useCallback(() => {
    const json = exportSession();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `r3vibe-session-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [exportSession]);

  // Handle session export
  const handleExport = useCallback(() => {
    handleSave();
  }, [handleSave]);

  // Get session data for header controls
  const getSessionData = useCallback(() => ({
    bpm: state.bpm,
    fx: state.fx,
    filterVal: state.filterVal,
    pitchSemitones: state.pitchSemitones,
    recordedEvents: state.recordedEvents,
  }), [state.bpm, state.fx, state.filterVal, state.pitchSemitones, state.recordedEvents]);

  // Handle microphone audio data
  const handleMicrophoneData = useCallback((data: Float32Array) => {
    // Process microphone data if needed
    // This can be used for visualization or further audio processing
  }, []);

  return (
    <div className="min-h-screen studio-bg p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <Card className="bg-card/90 backdrop-blur-sm border-border/40 shadow-2xl shadow-black/30 p-4 md:p-6">
          {/* Header */}
          <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-primary tracking-tight" data-testid="text-title">
                R3 Native Instrument
                <span className="text-sm md:text-base font-normal text-muted-foreground ml-2">
                  Virtual VSTs
                </span>
              </h1>
              <p className="text-xs text-muted-foreground mt-1">
                Designed By Ernesto
              </p>
            </div>
            <HeaderControls
              theme={theme}
              onThemeChange={setTheme}
              bpm={state.bpm}
              onBpmChange={setBpm}
              metronomeOn={state.metronomeOn}
              onMetronomeToggle={toggleMetronome}
              onSave={handleSave}
              onLoad={importSession}
              getSessionData={getSessionData}
            />
          </header>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-4 md:gap-6">
            {/* Left Column - Instruments */}
            <div className="space-y-6">
              {/* Drum Pads */}
              <section className="p-4 rounded-xl bg-muted/20 border border-border/30">
                <DrumPads
                  pads={state.pads}
                  onTrigger={triggerPad}
                  onAssignSample={assignPadSample}
                  loadSample={loadSample}
                />
              </section>

              {/* Piano Keys */}
              <section className="p-4 rounded-xl bg-muted/20 border border-border/30">
                <PianoKeys
                  keys={state.keys}
                  onTrigger={triggerKey}
                  onAssignSample={assignKeySample}
                  loadSample={loadSample}
                />
              </section>

              {/* Waveform Editor */}
              <section className="p-4 rounded-xl bg-muted/20 border border-border/30">
                <WaveformEditor
                  getWaveformData={getWaveformData}
                  isInitialized={isInitialized}
                />
              </section>
            </div>

            {/* Right Column - Controls */}
            <aside className="space-y-4">
              {/* Audio Visualizer & Transport */}
              <section className="p-4 rounded-xl bg-muted/20 border border-border/30">
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
              </section>

              {/* Microphone Input */}
              <section className="p-4 rounded-xl bg-muted/20 border border-border/30">
                <MicrophoneInput onAudioData={handleMicrophoneData} />
              </section>

              {/* FX Panel */}
              <section>
                <FXPanel fx={state.fx} onToggle={toggleFX} />
              </section>

              {/* DJ Controls */}
              <section>
                <DJControls
                  filterVal={state.filterVal}
                  pitchSemitones={state.pitchSemitones}
                  crossfade={state.crossfade}
                  onFilterChange={setFilter}
                  onPitchChange={setPitch}
                  onCrossfadeChange={setCrossfade}
                />
              </section>

              {/* Quick Start Guide */}
              <div className="p-4 rounded-lg bg-card/30 border border-border/20 text-xs text-muted-foreground">
                <p className="font-medium mb-1">🎵 Quick Start:</p>
                <ul className="space-y-1 ml-4 list-disc">
                  <li>Click or use keyboard shortcuts (QWERTY for pads, ZSXDC for piano)</li>
                  <li>Upload custom samples via the upload button</li>
                  <li>Arm and record your performance</li>
                  <li>Apply FX and DJ controls in real-time</li>
                </ul>
              </div>
            </aside>
          </div>

          {/* Footer */}
          <footer className="mt-6 flex flex-col md:flex-row md:justify-between gap-2 text-xs text-muted-foreground p-3 rounded-lg bg-muted/10 border border-border/20">
            <div data-testid="text-features">
              Polyphony • Accessible • Mobile-friendly • Offline-first
            </div>
            <div className="opacity-70" data-testid="text-tech">
              Made with Web Audio API, Web MIDI API & IndexedDB by Ernesto
            </div>
          </footer>
        </Card>

        {/* Initialization Overlay */}
        {!isInitialized && (
          <div className="fixed inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-50">
            <Card className="p-8 text-center max-w-md mx-4">
              <div className="mb-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                  <Mic className="w-8 h-8 text-primary" />
                </div>
              </div>
              <h2 className="text-xl font-semibold mb-3">Initialize Audio Engine</h2>
              <p className="text-muted-foreground mb-4">
                Click anywhere or press any key to start the audio engine and begin making music.
              </p>
              <div className="animate-pulse text-primary text-sm font-medium">
                Click or press any key...
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

// Import Mic icon for initialization overlay
import { Mic } from 'lucide-react';