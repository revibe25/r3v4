// Main component
export { MultiTrackPanel as default } from './multi-track-panel';
export { MultiTrackPanel } from './multi-track-panel';

// Types
export type {
  TrackType,
  FXType,
  MixerView,
  TimeFormat,
  ViewMode,
  AutomationMode,
  AudioClip,
  AutomationPoint,
  TrackAutomation,
  AdvancedTrack,
  TransportState,
  Preferences,
  ProjectState,
  MixerViewProps,
  TimelineViewProps,
  WaveformDisplayProps,
  AdvancedMeterProps,
  PreferencesModalProps,
  VSTPanelModalProps,
} from './types';

// Constants
export {
  THEME_COLORS,
  COLOR_SCHEME,
  FX_ICONS,
  TRACK_COLORS,
  DEFAULT_BUFFER_SIZE,
  DEFAULT_SAMPLE_RATE,
  DEFAULT_TEMPO,
  DEFAULT_TIME_SIGNATURE,
  MAX_ZOOM,
  MIN_ZOOM,
  ZOOM_STEP,
} from './constants';

// Utilities
export {
  formatTime,
  generateId,
  clamp,
  gainToDb,
  dbToGain,
  findTrackById,
  findClipById,
  calculatePeakWithDecay,
  serializeProject,
  downloadFile,
} from './utils';

// Audio Engine
export { AudioEngine } from './audio-engine';

// Components
export { TimelineView } from './components/timeline-view';
export { WaveformDisplay } from './components/waveform-display';
export { AdvancedMeter } from './components/advanced-meter';
export { PreferencesModal } from './components/preferences-modal';
export { VSTPanelModal } from './components/vst-panel-modal';

app.get('/health', (_, res) => res.status(200).json({ status: 'ok' }));
app.get('/ready',  (_, res) => res.status(200).json({ status: 'ready' }));
