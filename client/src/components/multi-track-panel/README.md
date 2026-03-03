# MultiTrackPanel - Refactored Architecture

A professional, modular DAW (Digital Audio Workstation) interface built with React and TypeScript.

## 📁 File Structure

```
multi-track-panel/
├── index.ts                  # Main exports
├── MultiTrackPanel.tsx       # Main orchestrator component
├── types.ts                  # TypeScript type definitions
├── constants.ts              # App-wide constants
├── utils.ts                  # Utility functions
├── AudioEngine.ts            # Audio processing engine
├── MixerView.tsx             # Mixer console view
├── TimelineView.tsx          # Timeline/arranger view
├── WaveformDisplay.tsx       # Audio waveform renderer
├── AdvancedMeter.tsx         # Audio level meter
├── PreferencesModal.tsx      # Settings modal
└── VSTPanelModal.tsx         # VST plugin modal
```

## 🏗️ Architecture

### Core Components

#### **MultiTrackPanel** (Main Component)
- Orchestrates all subcomponents
- Manages project state
- Handles transport controls (play, stop, record)
- Coordinates audio engine
- Manages modals and preferences

#### **MixerView**
- Displays mixer console interface
- Track faders, pan controls
- Meter displays
- Mute/Solo buttons
- FX chain display

#### **TimelineView**
- Timeline/arranger interface
- Audio clip placement and editing
- Drag-and-drop clip positioning
- Waveform visualization
- Playhead and loop region display

#### **AudioEngine**
- Web Audio API integration
- Audio file loading and decoding
- Waveform data generation
- Recording functionality
- Meter level calculation

#### **WaveformDisplay**
- Canvas-based waveform rendering
- Customizable colors and dimensions
- Mirrored waveform display
- Performance-optimized drawing

#### **AdvancedMeter**
- Professional audio level meter
- Peak hold indicator
- dB scale markings
- Clip indicator
- Gradient color coding

### Modals

#### **PreferencesModal**
- Theme selection (dark/light)
- Mixer view options
- Time format selection
- Audio settings (sample rate, buffer size)
- Display preferences

#### **VSTPanelModal**
- VST plugin interface
- Plugin performance monitoring
- Integration with VST context

## 🎯 Features

### Transport Controls
- Play/Pause
- Stop
- Record
- Loop region
- Tempo and time signature display

### Track Management
- Multiple audio tracks
- Track arming
- Mute/Solo
- Volume and pan controls
- FX chain management

### Audio Editing
- Clip import and placement
- Waveform visualization
- Drag-and-drop editing
- Zoom controls

### View Modes
- **Mixer**: Full mixer console view
- **Timeline**: Timeline/arranger view
- **Split**: Both views side-by-side

### Performance
- CPU usage monitoring
- Real-time meter updates
- Optimized rendering with `useCallback` and `useMemo`
- Efficient audio processing

### Project Management
- Save/Load projects (.dawproject format)
- Auto-save support
- Project title and metadata

## 🔧 Technical Details

### State Management
- React hooks (`useState`, `useEffect`, `useRef`, `useCallback`)
- Centralized project state
- Immutable state updates

### Type Safety
- Comprehensive TypeScript types
- Strict type checking
- Well-defined interfaces

### Performance Optimizations
- `useCallback` for event handlers
- `useRef` for non-reactive values
- `requestAnimationFrame` for smooth playback
- Canvas-based rendering for waveforms and meters

### Accessibility
- ARIA labels on interactive elements
- Keyboard-friendly controls
- Semantic HTML structure

## 📝 Usage

### Basic Import
```typescript
import { MultiTrackPanel } from './multi-track-panel';

function App() {
  return <MultiTrackPanel />;
}
```

### Using Individual Components
```typescript
import { MixerView, TimelineView, AudioEngine } from './multi-track-panel';

// Use components individually
```

### Custom Configuration
```typescript
import { createInitialPreferences } from './multi-track-panel';

const customPrefs = {
  ...createInitialPreferences(),
  theme: 'light',
  mixerView: 'wide',
};
```

## 🎨 Styling

The project uses Tailwind CSS for styling with a dark/light theme system.

### Theme Configuration
- Dark theme: Slate color palette
- Light theme: Gray color palette
- Customizable via `THEME_COLORS` constant

### Color Coding
- Tracks: Random color assignment from palette
- Meters: Gradient from green (good) to red (clipping)
- Transport: Blue for active states

## 🔌 Integration

### VST Context
Integrates with external VST plugin system via `useVSTContext`:
```typescript
const { vstState, addPlugin, removePlugin } = useVSTContext();
```

### Required Dependencies
- React 18+
- TypeScript 4.5+
- Tailwind CSS
- Lucide React (icons)
- Wouter (routing)

## 🚀 Performance Considerations

1. **Audio Processing**: Uses Web Audio API for low-latency processing
2. **Rendering**: Canvas-based for waveforms and meters
3. **State Updates**: Batched and optimized with React hooks
4. **Memory**: Proper cleanup in `useEffect` hooks

## 🐛 Error Handling

- Try-catch blocks for audio operations
- Null checks for optional values
- Graceful degradation for missing features
- Console error logging

## 📊 Metrics

- **Lines of Code**: ~1,500 (split across 12 files)
- **Components**: 8 main components
- **Type Definitions**: 15+ interfaces
- **Utility Functions**: 7 helpers

## 🔄 Future Enhancements

- MIDI support
- More FX plugins
- Advanced automation editing
- Multi-track recording
- Undo/Redo system
- Keyboard shortcuts
- Export/render functionality

## 📄 License

This is a refactored version maintaining all original functionality with improved:
- Code organization
- Type safety
- Performance
- Maintainability
- Documentation