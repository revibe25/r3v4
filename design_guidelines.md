# R3VIBE Native - Windows Desktop Application Design Guidelines

## Design Approach
**Reference-Based Approach**: Professional audio production software (Ableton Live, FL Studio, Native Instruments)
- Dark-first interface optimized for extended studio sessions
- High contrast for quick visual scanning of controls
- Professional visual hierarchy for complex control surfaces
- Utilitarian design that prioritizes functionality over decoration

## Core Design Principles
1. **Studio-Grade Aesthetics**: Dark, focused interface that reduces eye strain during long sessions
2. **Instant Visual Feedback**: Every interaction provides immediate, clear feedback
3. **Density with Clarity**: Pack functionality without overwhelming the user
4. **Professional Polish**: Desktop application should feel native and premium

## Typography
- **Primary Font**: Inter (system-ui fallback)
- **Headings**: 600-700 weight, 1.2-1.5rem for section headers
- **Controls/Labels**: 500-600 weight, 0.875-1rem
- **Small Labels**: 400 weight, 0.75-0.875rem for parameter labels
- **Monospace Numbers**: Use tabular-nums for BPM, timing displays

## Layout System
**Spacing Units**: Tailwind units of 2, 4, 8, 12, 16 for consistent rhythm
- Component padding: p-4 to p-6
- Section gaps: gap-4 to gap-6
- Control spacing: gap-2 to gap-4
- Outer margins: 26px desktop, 12px mobile

**Grid Structure**:
- Main layout: Two-column (instrument panel + mixer/FX sidebar)
- Pad grid: 8-column desktop, 4-column mobile
- Piano: Horizontal flex layout with absolute-positioned black keys
- FX panel: 5-column grid desktop, 2-column mobile

## Component Library

### Drum Pads (Primary Interaction)
- Size: 56px height, full-width responsive
- Resting state: Subtle gradient with glass morphism
- Active state: Bright accent gradient with elevation (translateY -3px, scale 1.04)
- Monitoring bars: 7px height indicator strips showing audio levels
- Haptic feel: Quick transitions (0.15-0.18s)

### Piano Keys
- White keys: 35px width, 108px height with subtle shadow
- Black keys: 22px width, 66px height, absolutely positioned
- Active state: Accent color fill with inner glow
- Key labels: Bottom-aligned, small weight text

### Control Buttons
- Style: Glass morphism with subtle borders
- Padding: 8-10px
- Border radius: 9px
- Hover: Slight brightness increase
- Transport controls: Emoji prefixes for quick recognition

### Toggle Switches (FX)
- Size: 52x33px rounded rectangles
- LED indicators: 9px circles with glow when active
- Active state: Accent gradient background
- Grid layout for uniform presentation

### Knobs (DJ Controls)
- Size: 45x45px circular
- Visual: Gradient background with indicator line
- Interaction: Drag to rotate, shows parameter value
- Labels: Centered below knob, 12px size

### Audio Visualizer
- Canvas: 630x120px with dark gradient background
- Waveform: Real-time frequency/amplitude visualization
- Style: Accent color gradient for audio bars
- Border radius: 13px for consistency

### Waveform Editor
- Canvas: Full-width, 100px height
- Background: Deep dark (#020617)
- Zoom controls: Small buttons below canvas
- Selection: Visual highlight for trim operations

### Meters/Progress Bars
- Height: 8px with rounded corners
- Fill: Linear gradient (accent to cyan)
- Smooth transitions: 0.08s for real-time feel

## Color Strategy (Maintained from Original)
**Dark Theme (Default)**:
- Background: Linear gradient #0a1022 to #071128
- Panel: rgba(18,22,34,0.93) glass effect
- Accent: #60a5fa (bright blue)
- Text: #9fb6d0 (muted blue-gray)

**Additional Themes**:
- Neon: Cyan/purple gradient with electric accents
- Light: Soft blue gradient for daylight sessions

## Desktop Application Enhancements

### Window Chrome
- Native window controls (minimize, maximize, close)
- Custom title bar with app branding
- Menu bar: File, Edit, View, Window, Help

### Status Bar (Footer)
- Left: Current project name, sample rate info
- Right: CPU/memory usage meters
- Height: Compact but readable (10px padding)

### File Management
- Drag-and-drop support for audio files onto pads/keys
- Recent projects menu
- Auto-save with recovery

### Keyboard Shortcuts
- Visual keyboard overlay (toggle with ?)
- Highlighted keys when pressed
- MIDI learn mode for external controllers

## Responsive Behavior
- Desktop (>980px): Two-column layout with full sidebar
- Tablet (640-980px): Stacked layout, collapsible sidebar
- Mobile (<640px): Simplified pad grid (4-column), minimal chrome

## Accessibility
- Focus states: 2px accent outline with offset
- ARIA labels: All interactive elements properly labeled
- Keyboard navigation: Tab through all controls
- Screen reader announcements for state changes

## Animation Guidelines
**Use Sparingly**:
- Pad activation: 0.15-0.18s transform and color shift
- Knob rotation: Immediate visual feedback
- Meter animations: 0.08s for real-time audio response
- No decorative animations - only functional feedback

## Images
**No hero images required** - This is a utility application focused on controls and functionality rather than marketing content.

## Professional Polish Details
- Drop shadows: Subtle elevation (0 14px 55px with low opacity)
- Glass morphism: rgba overlays for depth
- Consistent border radius: 9-15px throughout
- Input focus: Clear accent-colored outlines
- Loading states: Subtle spinners for audio processing
- Toast notifications: Bottom-right, dark overlay, 11px padding