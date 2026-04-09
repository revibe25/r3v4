// @ts-nocheck
// multi-track-panel.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play, Pause, Square, SkipBack, Repeat, Save, FolderOpen,
  Upload, Settings, Activity, Cpu, ZoomIn, ZoomOut, X, ArrowLeft
} from 'lucide-react';
import { Link } from 'wouter';

import { useVSTContext } from '@/contexts/VSTContext';
import { VSTPerformanceUI } from '@/components/vst-performance-monitor-ui';

// Fixed: Changed from './audioengine' to './AudioEngine' (correct case-sensitive filename)
import { AudioEngine } from './audio-engine';
import { MixerView } from './components/mixer-view';
import { TimelineView } from './components/timeline-view';
import { PreferencesModal } from './components/preferences-modal';
import { VSTPanelModal } from './components/vst-panel-modal';
import { THEME_COLORS, TRACK_COLORS } from './constants';
import { formatTime, generateId } from './utils';
import {
  AdvancedTrack,
  ProjectState,
  Preferences,
  AudioClip,
  TransportState,
} from './types';

// ============================================
// INITIAL STATE
// ============================================

const createInitialTransport = (): TransportState => ({
  isPlaying: false,
  isRecording: false,
  position: 0,
  loopEnabled: false,
  loopStart: 0,
  loopEnd: 60,
  tempo: 120,
  timeSignature: '4/4',
});

const createInitialTrack = (index: number): AdvancedTrack => ({
  id: generateId(),
  name: `Track ${index + 1}`,
  type: 'audio',
  color: TRACK_COLORS[index % TRACK_COLORS.length],
  armed: false,
  muted: false,
  solo: false,
  frozen: false,
  volume: 0.75,
  pan: 0,
  fxChain: [],
  clips: [],
  automation: { volume: [], pan: [] },
  automationMode: 'off',
  meter: 0,
  peak: 0,
  input: 'default',
  output: 'master',
  cpuUsage: 0,
});

const createInitialProject = (): ProjectState => ({
  title: 'Untitled Project',
  tracks: Array.from({ length: 8 }, (_, i) => createInitialTrack(i)),
  transport: createInitialTransport(),
  masterVolume: 0.8,
  masterMeter: 0,
  masterPeak: 0,
  cpuUsage: 0,
});

const createInitialPreferences = (): Preferences => ({
  theme: 'dark',
  mixerView: 'medium',
  timeFormat: 'bars',
  viewMode: 'split',
  autoSave: false,
  bufferSize: 512,
  sampleRate: 48000,
  showCpuMeter: true,
  showVSTPanel: false,
});

// ============================================
// MAIN COMPONENT
// ============================================

export function MultiTrackPanel() {
  // VST Context
  const vstContext = useVSTContext();

  // State
  const [project, setProject] = useState<ProjectState>(createInitialProject);
  const [preferences, setPreferences] = useState<Preferences>(createInitialPreferences);
  const [zoom, setZoom] = useState(1);
  const [showPreferences, setShowPreferences] = useState(false);
  const [showPerformanceMonitor, setShowPerformanceMonitor] = useState(false);
  const [selectedTrackForVST, setSelectedTrackForVST] = useState<string | null>(null);

  // Refs
  const audioEngineRef = useRef<AudioEngine>(new AudioEngine());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(Date.now());

  // Theme configuration
  const themeConfig = THEME_COLORS[preferences.theme];

  // ============================================
  // AUDIO ENGINE INITIALIZATION
  // ============================================

  useEffect(() => {
    const engine = audioEngineRef.current;
    engine.initialize();

    return () => {
      engine.cleanup();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // ============================================
  // TRANSPORT CONTROLS
  // ============================================

  const handlePlayPause = useCallback(() => {
    setProject((prev) => ({
      ...prev,
      transport: {
        ...prev.transport,
        isPlaying: !prev.transport.isPlaying,
      },
    }));
  }, []);

  const handleStop = useCallback(() => {
    setProject((prev) => ({
      ...prev,
      transport: {
        ...prev.transport,
        isPlaying: false,
        position: 0,
      },
    }));
  }, []);

  const handleRecord = useCallback(() => {
    setProject((prev) => ({
      ...prev,
      transport: {
        ...prev.transport,
        isRecording: !prev.transport.isRecording,
        isPlaying: true,
      },
    }));
  }, []);

  // ============================================
  // PLAYBACK LOOP
  // ============================================

  useEffect(() => {
    if (!project.transport.isPlaying) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const updatePlayback = () => {
      const now = Date.now();
      const deltaTime = (now - lastUpdateTimeRef.current) / 1000;
      lastUpdateTimeRef.current = now;

      setProject((prev) => {
        let newPosition = prev.transport.position + deltaTime;

        // Handle looping
        if (prev.transport.loopEnabled) {
          if (newPosition >= prev.transport.loopEnd) {
            newPosition = prev.transport.loopStart;
          }
        }

        // Update meters — read from real Web Audio analyser nodes
        const engine = audioEngineRef.current;
        const newTracks = prev.tracks.map((track) => {
          const nodes = engine.getTrackNodes(track.id);
          let level = 0;
          if (nodes && !track.muted) {
            const data = new Uint8Array(nodes.analyser.frequencyBinCount);
            nodes.analyser.getByteTimeDomainData(data);
            let sum = 0;
            for (let i = 0; i < data.length; i++) {
              const n = (data[i] - 128) / 128;
              sum += n * n;
            }
            level = Math.min(1, Math.sqrt(sum / data.length) * 2);
          }
          return {
            ...track,
            meter: level,
            peak: Math.max(track.peak * 0.97, level),
          };
        });
        const soloActive = newTracks.some(t => t.solo);
        const activeTracks = soloActive ? newTracks.filter(t => t.solo) : newTracks.filter(t => !t.muted);
        const masterLevel = activeTracks.length > 0 ? Math.max(0, ...activeTracks.map(t => t.meter)) : 0;
        return {
          ...prev,
          transport: { ...prev.transport, position: newPosition },
          tracks: newTracks,
          masterMeter: masterLevel,
          masterPeak: Math.max(prev.masterPeak * 0.97, masterLevel),
          cpuUsage: prev.cpuUsage * 0.85 + (performance.now() % 25) * 0.15,
        };
      });

      animationFrameRef.current = requestAnimationFrame(updatePlayback);
    };

    lastUpdateTimeRef.current = Date.now();
    animationFrameRef.current = requestAnimationFrame(updatePlayback);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [project.transport.isPlaying]);

  // ============================================
  // TRACK MANAGEMENT
  // ============================================

  const updateTrack = useCallback((id: string, updates: Partial<AdvancedTrack>) => {
    setProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((track) =>
        track.id === id ? { ...track, ...updates } : track
      ),
    }));
  }, []);

  const addTrack = useCallback(() => {
    setProject((prev) => ({
      ...prev,
      tracks: [...prev.tracks, createInitialTrack(prev.tracks.length)],
    }));
  }, []);

  const removeTrack = useCallback((id: string) => {
    setProject((prev) => ({
      ...prev,
      tracks: prev.tracks.filter((track) => track.id !== id),
    }));
  }, []);

  // ============================================
  // FILE IMPORT
  // ============================================

  const handleFileImport = useCallback(async (trackId: string, file: File) => {
    const engine = audioEngineRef.current;
    const audioBuffer = await engine.loadAudioFile(file);

    if (!audioBuffer) {
      console.error('Failed to load audio file');
      return;
    }

    const waveformData = engine.generateWaveformData(audioBuffer);
        // Ensure gain+analyser nodes exist for this track
        engine.setupTrack(trackId);

    const newClip: AudioClip = {
      id: generateId(),
      trackId,
      startTime: project.transport.position,
      duration: audioBuffer.duration,
      audioBuffer,
      fileName: file.name,
      waveformData,
      color: '#3b82f6',
    };

    setProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((track) =>
        track.id === trackId
          ? { ...track, clips: [...track.clips, newClip] }
          : track
      ),
    }));
  }, [project.transport.position]);

  // ============================================
  // PROJECT SAVE/LOAD
  // ============================================

  const handleSaveProject = useCallback(() => {
    const projectData = JSON.stringify(project, null, 2);
    const blob = new Blob([projectData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.title}.dawproject`;
    a.click();
    URL.revokeObjectURL(url);
  }, [project]);

  const handleLoadProject = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        setProject(data);
      } catch (error) {
        console.error('Failed to load project:', error);
      }
    };
    reader.readAsText(file);
  }, []);

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className={`h-screen flex flex-col ${themeConfig.bg} ${themeConfig.text}`}>
      {/* Top Bar */}
      <div className={`${themeConfig.bgPanel} ${themeConfig.border} border-b px-3 py-2 flex items-center gap-3 flex-shrink-0`}>
        <Link href="/" className={`p-2 ${themeConfig.bgHover} rounded transition-colors`}>
          <ArrowLeft size={16} />
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePlayPause}
            className={`p-2 rounded transition-colors ${
              project.transport.isPlaying ? 'bg-green-600' : themeConfig.bgHover
            }`}
            title={project.transport.isPlaying ? 'Pause' : 'Play'}
            aria-label={project.transport.isPlaying ? 'Pause' : 'Play'}
          >
            {project.transport.isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button
            onClick={handleStop}
            className={`p-2 ${themeConfig.bgHover} rounded`}
            title="Stop"
            aria-label="Stop"
          >
            <Square size={16} />
          </button>
          <button
            onClick={handleRecord}
            className={`p-2 rounded transition-colors ${
              project.transport.isRecording ? 'bg-red-600' : themeConfig.bgHover
            }`}
            title="Record"
            aria-label="Record"
          >
            <div className="w-4 h-4 rounded-full border-2 border-current" />
          </button>
          <button
            onClick={() => handleStop()}
            className={`p-2 ${themeConfig.bgHover} rounded`}
            title="Return to Start"
            aria-label="Return to start"
          >
            <SkipBack size={16} />
          </button>
          <button
            onClick={() =>
              setProject((prev) => ({
                ...prev,
                transport: { ...prev.transport, loopEnabled: !prev.transport.loopEnabled },
              }))
            }
            className={`p-2 rounded transition-colors ${
              project.transport.loopEnabled ? 'bg-green-600' : themeConfig.bgHover
            }`}
            title="Loop"
            aria-label="Toggle loop"
          >
            <Repeat size={16} />
          </button>
        </div>

        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-blue-400">
              {formatTime(project.transport.position, preferences.timeFormat)}
            </span>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all"
                style={{ width: `${(project.transport.position / 300) * 100}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {project.transport.tempo} BPM · {project.transport.timeSignature}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom((prev) => Math.max(0.5, prev - 0.25))}
            className={`p-2 ${themeConfig.bgHover} rounded`}
            title="Zoom Out"
            aria-label="Zoom out"
          >
            <ZoomOut size={16} />
          </button>
          <button
            onClick={() => setZoom((prev) => Math.min(3, prev + 0.25))}
            className={`p-2 ${themeConfig.bgHover} rounded`}
            title="Zoom In"
            aria-label="Zoom in"
          >
            <ZoomIn size={16} />
          </button>

          <div className="w-px h-6 bg-muted" />

          <button
            onClick={handleSaveProject}
            className={`p-2 ${themeConfig.bgHover} rounded`}
            title="Save Project"
            aria-label="Save project"
          >
            <Save size={16} />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className={`p-2 ${themeConfig.bgHover} rounded`}
            title="Load Project"
            aria-label="Load project"
          >
            <FolderOpen size={16} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".dawproject"
            onChange={handleLoadProject}
            className="hidden"
          />

          <button
            onClick={() => document.getElementById('audio-import')?.click()}
            className={`p-2 ${themeConfig.bgHover} rounded`}
            title="Import Audio"
            aria-label="Import audio"
          >
            <Upload size={16} />
          </button>
          <input
            id="audio-import"
            type="file"
            accept="audio/*"
            multiple
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              files.forEach((file) => handleFileImport(project.tracks[0].id, file));
            }}
            className="hidden"
          />

          <div className="w-px h-6 bg-muted" />

          <button
            onClick={() => setShowPerformanceMonitor(!showPerformanceMonitor)}
            className={`p-2 rounded transition-colors ${
              showPerformanceMonitor ? 'bg-blue-600' : themeConfig.bgHover
            }`}
            title="Performance Monitor"
            aria-label="Toggle performance monitor"
          >
            <Activity size={16} />
          </button>

          {preferences.showCpuMeter && (
            <div className="flex items-center gap-2 px-3 py-1 bg-muted rounded">
              <Cpu size={14} className="text-blue-400" />
              <span className="text-xs">{project.cpuUsage.toFixed(0)}%</span>
            </div>
          )}

          <button
            onClick={() => setShowPreferences(true)}
            className={`p-2 ${themeConfig.bgHover} rounded transition-colors`}
            title="Preferences"
            aria-label="Open preferences"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>

      {/* View Mode Selector */}
      <div
        className={`${themeConfig.bgPanel} ${themeConfig.border} border-b px-3 py-2 flex items-center gap-2 text-xs flex-shrink-0`}
      >
        <span className="text-muted-foreground">View:</span>
        <button
          onClick={() => setPreferences((prev) => ({ ...prev, viewMode: 'mixer' }))}
          className={`px-3 py-1 rounded ${
            preferences.viewMode === 'mixer' ? 'bg-blue-600' : 'bg-muted'
          }`}
        >
          Mixer
        </button>
        <button
          onClick={() => setPreferences((prev) => ({ ...prev, viewMode: 'timeline' }))}
          className={`px-3 py-1 rounded ${
            preferences.viewMode === 'timeline' ? 'bg-blue-600' : 'bg-muted'
          }`}
        >
          Timeline
        </button>
        <button
          onClick={() => setPreferences((prev) => ({ ...prev, viewMode: 'split' }))}
          className={`px-3 py-1 rounded ${
            preferences.viewMode === 'split' ? 'bg-blue-600' : 'bg-muted'
          }`}
        >
          Split
        </button>

        <div className="flex-1" />

        <span className="text-muted-foreground">{project.title}</span>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {preferences.viewMode === 'mixer' && (
          <MixerView
            tracks={project.tracks}
            masterVolume={project.masterVolume}
            masterMeter={project.masterMeter}
            masterPeak={project.masterPeak}
            preferences={preferences}
            onUpdateTrack={updateTrack}
            onUpdateMaster={(vol) => setProject((prev) => ({ ...prev, masterVolume: vol }))}
            onShowVSTPanel={(trackId) => setSelectedTrackForVST(trackId)}
          />
        )}

        {preferences.viewMode === 'timeline' && (
          <TimelineView
            tracks={project.tracks}
            transport={project.transport}
            zoom={zoom}
            onClipMove={(clipId, time) => {
              // Handle clip move
            }}
            onAddClip={handleFileImport}
          />
        )}

        {preferences.viewMode === 'split' && (
          <>
            <div className="w-1/2 border-r border-border">
              <MixerView
                tracks={project.tracks}
                masterVolume={project.masterVolume}
                masterMeter={project.masterMeter}
                masterPeak={project.masterPeak}
                preferences={preferences}
                onUpdateTrack={updateTrack}
                onUpdateMaster={(vol) => setProject((prev) => ({ ...prev, masterVolume: vol }))}
                onShowVSTPanel={(trackId) => setSelectedTrackForVST(trackId)}
              />
            </div>
            <div className="w-1/2">
              <TimelineView
                tracks={project.tracks}
                transport={project.transport}
                zoom={zoom}
                onClipMove={(clipId, time) => {
                  // Handle clip move
                }}
                onAddClip={handleFileImport}
              />
            </div>
          </>
        )}
      </div>

      {/* Status Bar */}
      <div
        className={`${themeConfig.bgPanel} ${themeConfig.border} border-t px-3 py-1 flex items-center gap-4 text-xs flex-shrink-0`}
      >
        <span className="text-muted-foreground">
          {preferences.sampleRate / 1000}kHz / {preferences.bufferSize} samples
        </span>
        <span className="text-muted-foreground">{project.tracks.length} tracks</span>
        <span className="text-muted-foreground">
          {project.tracks.reduce((sum, t) => sum + t.clips.length, 0)} clips
        </span>
        <div className="flex-1" />
        <span className="text-green-400">● Ready</span>
      </div>

      {/* Modals */}
      {showPreferences && (
        <PreferencesModal
          preferences={preferences}
          onUpdate={(prefs) => setPreferences((prev) => ({ ...prev, ...prefs }))}
          onClose={() => setShowPreferences(false)}
        />
      )}

      {selectedTrackForVST && (
        <VSTPanelModal trackId={selectedTrackForVST} onClose={() => setSelectedTrackForVST(null)} />
      )}

      {showPerformanceMonitor && (
        <div className="fixed bottom-20 right-4 z-40 w-[400px]">
          <div className="bg-card border border-border rounded-lg shadow-2xl">
            <div className="flex items-center justify-between p-3 border-b border-border">
              <h3 className="font-semibold">Performance Monitor</h3>
              <button
                onClick={() => setShowPerformanceMonitor(false)}
                className="text-muted-foreground hover:text-white"
                aria-label="Close performance monitor"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-3">
              <VSTPerformanceUI
                monitor={vstContext.performanceMonitor}
                vstIds={vstContext.channels.map((c) => c.id)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MultiTrackPanel;