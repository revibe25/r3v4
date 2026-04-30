import React from 'react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { 
  Play, 
  Pause, 
  Square, 
  SkipBack, 
  SkipForward,
  Mic,
  Volume2,
  Settings,
  Layers,
  AudioWaveform,
  Music
} from 'lucide-react'

/**
 * Example DAW Layout showcasing the 3D Metal Theme
 * This demonstrates how to use the metal theme components
 */
export function MetalDAWLayout() {
  const [isPlaying, setIsPlaying] = React.useState(false)
  const [isRecording, setIsRecording] = React.useState(false)
  const [masterVolume, setMasterVolume] = React.useState([75])

  return (
    <div className="h-screen w-full bg-gradient-to-br from-metal-950 via-metal-900 to-metal-950 flex flex-col overflow-hidden">
      {/* ═══════════════════════════════════════════════════════════════
          TOP MENU BAR
          ═══════════════════════════════════════════════════════════════ */}
      <header className="metal-panel h-12 flex items-center justify-between px-4 shrink-0 border-b-2 border-metal-800">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <Music className="w-6 h-6 text-blue-400" />
          <h1 className="text-xl font-bold text-metal-text-embossed bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            R3-N-i DAW
          </h1>
        </div>

        {/* Menu buttons */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm">File</Button>
          <Button variant="ghost" size="sm">Edit</Button>
          <Button variant="ghost" size="sm">View</Button>
          <Button variant="ghost" size="sm">Mix</Button>
          <Button variant="ghost" size="sm">Help</Button>
        </div>

        {/* Utility buttons */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon-sm">
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════
          MAIN CONTENT AREA
          ═══════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT SIDEBAR - Mixer */}
        <aside className="w-80 metal-panel border-r-2 border-metal-700 flex flex-col shrink-0">
          <div className="p-4 border-b border-metal-800">
            <h2 className="text-sm font-bold text-metal-200 text-shadow-metal flex items-center gap-2">
              <Layers className="w-4 h-4" />
              MIXER
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Channel Strips */}
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="channel-strip">
                {/* Channel header */}
                <div className="channel-strip-header">
                  Track {i + 1}
                </div>

                {/* Controls */}
                <div className="flex gap-2 items-center justify-center py-2">
                  <Button variant="led" size="icon-sm" className="relative">
                    <span className={`absolute inset-1 rounded-full ${i === 0 ? 'led-red' : 'led-off'}`} />
                  </Button>
                  <Button variant="led" size="icon-sm" className="relative">
                    <span className="absolute inset-1 rounded-full led-off" />
                  </Button>
                  <Button variant="led" size="icon-sm" className="relative">
                    <span className="absolute inset-1 rounded-full led-off" />
                  </Button>
                </div>

                {/* Fader */}
                <div className="flex-1 flex items-center justify-center py-4">
                  <Slider
                    vertical
                    defaultValue={[70 - i * 15]}
                    max={100}
                    knobSize="sm"
                    className="h-32"
                  />
                </div>

                {/* VU Meter */}
                <div className="vu-meter-vertical h-24 mx-auto">
                  <div 
                    className="vu-meter-bar-vertical transition-all duration-100"
                    style={{ height: `${60 - i * 10}%` }}
                  />
                </div>

                {/* Pan */}
                <div className="mt-2">
                  <Slider
                    defaultValue={[50]}
                    max={100}
                    knobSize="sm"
                  />
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* CENTER - Main workspace */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="metal-panel-raised h-16 flex items-center gap-4 px-4 shrink-0 border-b border-metal-800">
            {/* Tool buttons */}
            <div className="flex gap-1">
              <Button variant="outline" size="icon">
                <AudioWaveform className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon">
                <Layers className="w-4 h-4" />
              </Button>
            </div>

            <div className="metal-divider-vertical h-8" />

            {/* Zoom controls */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-metal-400">Zoom:</span>
              <Slider
                defaultValue={[50]}
                max={100}
                className="w-32"
                knobSize="sm"
              />
            </div>
          </div>

          {/* Waveform area */}
          <div className="flex-1 waveform-container m-4">
            <div className="waveform-grid" />
            
            {/* Placeholder waveform */}
            <div className="relative h-full flex items-center justify-center">
              <div className="text-metal-600 text-sm">
                Drop audio files here or click to import
              </div>
            </div>
          </div>
        </main>

        {/* RIGHT SIDEBAR - Effects */}
        <aside className="w-64 metal-panel border-l-2 border-metal-700 flex flex-col shrink-0">
          <div className="p-4 border-b border-metal-800">
            <h2 className="text-sm font-bold text-metal-200 text-shadow-metal">
              EFFECTS RACK
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {/* FX Slots */}
            {['Compressor', 'EQ', 'Reverb', 'Delay'].map((fx, i) => (
              <div key={i} className="fx-slot">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-metal-200">{fx}</span>
                  <span className="led-indicator led-green" />
                </div>
                
                {/* Quick controls */}
                <div className="space-y-2">
                  <Slider defaultValue={[50]} max={100} knobSize="sm" showValue />
                  <Slider defaultValue={[30]} max={100} knobSize="sm" showValue />
                </div>
              </div>
            ))}

            {/* Add effect button */}
            <Button variant="outline" className="w-full" size="sm">
              + Add Effect
            </Button>
          </div>
        </aside>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          TRANSPORT BAR
          ═══════════════════════════════════════════════════════════════ */}
      <footer className="rack-unit h-24 flex items-center justify-between px-6 shrink-0 border-t-2 border-metal-700">
        {/* Transport controls */}
        <div className="flex items-center gap-3">
          <Button variant="transport" size="icon-lg">
            <SkipBack className="w-5 h-5" />
          </Button>
          
          <Button 
            variant={isPlaying ? 'play' : 'transport'}
            size="icon-lg"
            onClick={() => setIsPlaying(!isPlaying)}
            active={isPlaying}
            className="w-14 h-14"
          >
            {isPlaying ? (
              <Pause className="w-6 h-6" />
            ) : (
              <Play className="w-6 h-6 ml-0.5" />
            )}
          </Button>

          <Button variant="transport" size="icon-lg">
            <Square className="w-5 h-5" />
          </Button>

          <Button 
            variant={isRecording ? 'record' : 'transport'}
            size="icon-lg"
            onClick={() => setIsRecording(!isRecording)}
            active={isRecording}
          >
            <Mic className="w-5 h-5" />
          </Button>

          <Button variant="transport" size="icon-lg">
            <SkipForward className="w-5 h-5" />
          </Button>
        </div>

        {/* Time display */}
        <div className="metal-display px-6 py-3">
          <div className="font-mono text-2xl font-bold tabular-nums">
            00:00:00.000
          </div>
        </div>

        {/* BPM & Master volume */}
        <div className="flex items-center gap-6">
          {/* BPM */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs text-metal-400 font-semibold">BPM</span>
            <div className="lcd-display px-3 py-1">
              <span className="font-mono text-lg font-bold">120</span>
            </div>
          </div>

          {/* Master volume */}
          <div className="flex items-center gap-3">
            <Volume2 className="w-5 h-5 text-metal-400" />
            <Slider
              value={masterVolume}
              onValueChange={setMasterVolume}
              max={100}
              className="w-32"
              showValue
              valueDisplay={(v) => `${v}%`}
              ledIndicator
            />
          </div>

          {/* Master meter */}
          <div className="flex gap-1 items-center">
            <div className="vu-meter-vertical h-12 w-3">
              <div 
                className="vu-meter-bar-vertical transition-all duration-100 animate-meter-pulse"
                style={{ height: `${masterVolume[0]}%` }}
              />
            </div>
            <div className="vu-meter-vertical h-12 w-3">
              <div 
                className="vu-meter-bar-vertical transition-all duration-100 animate-meter-pulse"
                style={{ height: `${masterVolume[0] * 0.95}%` }}
              />
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default MetalDAWLayout