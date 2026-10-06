#!/bin/bash

################################################################################
#                                                                              #
#  R3 NATIVE MULTITRACK v1.3.0 — AUTOMATED IMPLEMENTATION ORCHESTRATOR      #
#                                                                              #
#  Master Script: Generates, deploys, tests 6 phases (42-54 hrs automated)   #
#                                                                              #
#  Usage:                                                                     #
#    bash MULTITRACK_AUTOMATION_MASTER.sh [phase] [action]                   #
#                                                                              #
#  Examples:                                                                  #
#    bash MULTITRACK_AUTOMATION_MASTER.sh 1 generate      # Generate Phase 1  #
#    bash MULTITRACK_AUTOMATION_MASTER.sh 1 deploy        # Deploy Phase 1    #
#    bash MULTITRACK_AUTOMATION_MASTER.sh all validate    # Validate all      #
#    bash MULTITRACK_AUTOMATION_MASTER.sh all execute     # Full pipeline     #
#                                                                              #
################################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="${PROJECT_ROOT:-.}"
CLIENT_SRC="${PROJECT_ROOT}/client/src"
FEATURES_DIR="${CLIENT_SRC}/features/multitrack-v130"
COMPONENTS_DIR="${FEATURES_DIR}/components"
STYLES_DIR="${FEATURES_DIR}/styles"
OUTPUT_DIR="/tmp/multitrack-automation"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="${OUTPUT_DIR}/backups/${TIMESTAMP}"

# Tracking
GENERATED_FILES=()
DEPLOYED_FILES=()
FAILED_OPERATIONS=()

################################################################################
# UTILITY FUNCTIONS
################################################################################

log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[✓]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[✗]${NC} $1"
}

log_section() {
  echo ""
  echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}  $1${NC}"
  echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
}

verify_environment() {
  log_section "ENVIRONMENT VERIFICATION"
  
  if [ ! -d "$PROJECT_ROOT" ]; then
    log_error "Project root not found: $PROJECT_ROOT"
    return 1
  fi
  log_success "Project root exists: $PROJECT_ROOT"
  
  if [ ! -d "$CLIENT_SRC" ]; then
    log_warn "Client source not found: $CLIENT_SRC"
    log_info "Will create directory structure when deploying"
  else
    log_success "Client source found: $CLIENT_SRC"
  fi
  
  mkdir -p "$OUTPUT_DIR" "$BACKUP_DIR"
  log_success "Output directories ready: $OUTPUT_DIR"
}

backup_file() {
  local file="$1"
  if [ -f "$file" ]; then
    mkdir -p "$BACKUP_DIR"
    cp "$file" "$BACKUP_DIR/$(basename $file).backup"
    log_info "Backed up: $file"
  fi
}

################################################################################
# PHASE 1: HEADER COMPONENTS (8-10 hours)
################################################################################

generate_header_brand() {
  cat > "${OUTPUT_DIR}/HeaderBrand.tsx" << 'EOF'
import React from 'react';
import styles from './HeaderBrand.module.css';

/**
 * R3 NATIVE Logo & Brand Component
 * Displays: SVG logo + "R3 NATIVE" text + tagline
 * Color: Acid green (#a6e22e)
 */
export const HeaderBrand: React.FC = () => {
  return (
    <div className={styles.brand}>
      <svg 
        viewBox="0 0 64 64" 
        xmlns="http://www.w3.org/2000/svg"
        className={styles.logo}
        role="img"
        aria-label="R3 NATIVE Logo"
      >
        {/* R3 Circle + Text */}
        <circle cx="32" cy="32" r="30" fill="none" stroke="currentColor" strokeWidth="2" />
        <text 
          x="32" 
          y="40" 
          fontSize="28" 
          fontWeight="700" 
          textAnchor="middle" 
          fill="currentColor"
          fontFamily="var(--f)"
        >
          R3
        </text>
      </svg>
      
      <div className={styles.brandText}>
        <b className={styles.title}>R3 NATIVE</b>
        <small className={styles.subtitle}>Professional multitrack workstation</small>
      </div>
    </div>
  );
};

export default HeaderBrand;
EOF
  GENERATED_FILES+=("${OUTPUT_DIR}/HeaderBrand.tsx")
  log_success "Generated: HeaderBrand.tsx"
}

generate_header_brand_css() {
  cat > "${OUTPUT_DIR}/HeaderBrand.module.css" << 'EOF'
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: none;
  width: 236px;
  padding: 0 8px;
}

.logo {
  height: 30px;
  width: 30px;
  color: var(--ac);
  flex-shrink: 0;
  transition: transform 0.2s;
}

.brand:hover .logo {
  transform: scale(1.05);
}

.brandText {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.title {
  display: block;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.32em;
  color: var(--ac);
  line-height: 1;
  white-space: nowrap;
}

.subtitle {
  display: block;
  font-size: 9px;
  letter-spacing: 0.03em;
  color: var(--dm);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
EOF
  GENERATED_FILES+=("${OUTPUT_DIR}/HeaderBrand.module.css")
  log_success "Generated: HeaderBrand.module.css"
}

generate_clock_display() {
  cat > "${OUTPUT_DIR}/ClockDisplay.tsx" << 'EOF'
import React, { useEffect, useState } from 'react';
import styles from './ClockDisplay.module.css';

interface ClockDisplayProps {
  currentTime: number; // seconds
  bpm: number;
  timeSignature: { numerator: number; denominator: number };
}

/**
 * Clock Display with Bar/Beat/Tick
 * Shows: 00:00:00.000 format + Bar 1 · Beat 1 · Tick 000
 * Updates at 60Hz to stay in sync with playhead
 */
export const ClockDisplay: React.FC<ClockDisplayProps> = ({ 
  currentTime = 0, 
  bpm = 120, 
  timeSignature = { numerator: 4, denominator: 4 }
}) => {
  const [display, setDisplay] = useState({ 
    time: '00:00:00.000', 
    bar: 1, 
    beat: 1, 
    tick: 0 
  });

  useEffect(() => {
    // Calculate bar/beat/tick from time
    const ticksPerBeat = 120; // MIDI standard (ticks per quarter note)
    const beatsPerBar = timeSignature.numerator;
    const secondsPerBeat = 60 / bpm;
    
    const totalBeats = currentTime / secondsPerBeat;
    const totalTicks = Math.round(totalBeats * ticksPerBeat);
    
    const beats = Math.floor(totalBeats);
    const bar = Math.floor(beats / beatsPerBar) + 1;
    const beat = (beats % beatsPerBar) + 1;
    const tick = totalTicks % ticksPerBeat;
    
    // Format time as HH:MM:SS.mmm
    const hours = Math.floor(currentTime / 3600);
    const minutes = Math.floor((currentTime % 3600) / 60);
    const seconds = Math.floor(currentTime % 60);
    const millis = Math.floor((currentTime % 1) * 1000);
    
    const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
    
    setDisplay({
      time: timeStr,
      bar,
      beat,
      tick: Math.floor(tick)
    });
  }, [currentTime, bpm, timeSignature]);

  return (
    <div className={styles.clock} role="region" aria-label="Clock display">
      <output className={styles.timeDisplay} id="tTime">
        {display.time}
      </output>
      <div className={styles.barBeatTick}>
        <span>Bar <b id="tBar" className={styles.barValue}>{display.bar}</b></span>
        <span>Beat <b id="tBeat" className={styles.beatValue}>{display.beat}</b></span>
        <span>Tick <b id="tTick" className={styles.tickValue}>{String(display.tick).padStart(3, '0')}</b></span>
      </div>
    </div>
  );
};

export default ClockDisplay;
EOF
  GENERATED_FILES+=("${OUTPUT_DIR}/ClockDisplay.tsx")
  log_success "Generated: ClockDisplay.tsx"
}

generate_clock_display_css() {
  cat > "${OUTPUT_DIR}/ClockDisplay.module.css" << 'EOF'
.clock {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 10px;
  font-variant-numeric: tabular-nums;
}

.timeDisplay {
  font-size: 14px;
  font-weight: 600;
  color: var(--ac);
  line-height: 1.2;
  letter-spacing: 0.05em;
}

.barBeatTick {
  display: flex;
  gap: 12px;
  font-size: 10px;
  color: var(--dm);
  line-height: 1.2;
}

.barValue,
.beatValue,
.tickValue {
  color: var(--tx);
  font-weight: 600;
  margin-left: 2px;
}
EOF
  GENERATED_FILES+=("${OUTPUT_DIR}/ClockDisplay.module.css")
  log_success "Generated: ClockDisplay.module.css"
}

phase_1_generate() {
  log_section "PHASE 1: GENERATING HEADER COMPONENTS"
  log_info "Components: HeaderBrand, ClockDisplay (with bar/beat/tick)"
  log_info "Effort: 3-4 hours | Coverage: 50-65%"
  
  generate_header_brand
  generate_header_brand_css
  generate_clock_display
  generate_clock_display_css
  
  log_success "Phase 1: Generated 4 files"
}

################################################################################
# PHASE 2: MIXER CONTROLS (10-12 hours)
################################################################################

generate_pan_knob() {
  cat > "${OUTPUT_DIR}/PanKnob.tsx" << 'EOF'
import React, { useState } from 'react';
import styles from './PanKnob.module.css';

interface PanKnobProps {
  value: number; // -1 (left) to 1 (right)
  onChange: (value: number) => void;
  label?: string;
  disabled?: boolean;
}

/**
 * Pan Knob Component
 * Visual rotary knob for stereo panning (L-C-R)
 * Draggable: drag up/down to adjust pan
 */
export const PanKnob: React.FC<PanKnobProps> = ({ 
  value = 0, 
  onChange, 
  label = 'Pan',
  disabled = false
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = () => {
    if (!disabled) setIsDragging(true);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || disabled) return;
    
    // Scale: 1px = 0.01 pan value
    const delta = e.movementX * 0.01;
    const newValue = Math.max(-1, Math.min(1, value + delta));
    onChange(newValue);
  };

  React.useEffect(() => {
    if (isDragging) {
      const handleMove = (e: MouseEvent) => handleMouseMove(e);
      const handleUp = () => setIsDragging(false);
      
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
      
      return () => {
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
      };
    }
  }, [isDragging, value]);

  const angle = (value + 1) * 45; // -1 = -45°, 0 = 0°, 1 = 45°
  const posLabel = value < -0.1 ? 'L' : value > 0.1 ? 'R' : 'C';
  const displayValue = Math.abs(Math.round(value * 100));

  return (
    <div 
      className={`${styles.panKnob} ${isDragging ? styles.dragging : ''}`}
      role="slider"
      aria-label={label}
      aria-valuemin={-100}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      aria-disabled={disabled}
    >
      <label className={styles.label}>{label}</label>
      
      <svg 
        className={styles.knobSvg}
        viewBox="0 0 64 64"
        width="40"
        height="40"
        onMouseDown={handleMouseDown}
        style={{ cursor: disabled ? 'not-allowed' : isDragging ? 'grabbing' : 'grab' }}
      >
        {/* Knob background circle */}
        <circle cx="32" cy="32" r="28" fill="none" stroke="var(--ln2)" strokeWidth="1" />
        
        {/* Pan indicator arc */}
        <circle 
          cx="32" 
          cy="32" 
          r="28" 
          fill="none" 
          stroke="var(--ac2)" 
          strokeWidth="2"
          strokeDasharray={`${Math.abs(angle / 360) * 176} 176`}
          strokeLinecap="round"
          opacity="0.6"
        />
        
        {/* Knob pointer line */}
        <line 
          x1="32" 
          y1="8" 
          x2="32" 
          y2="14"
          stroke="var(--ac)"
          strokeWidth="2"
          strokeLinecap="round"
          style={{ 
            transform: `rotate(${angle}deg)`,
            transformOrigin: '32px 32px',
            transition: isDragging ? 'none' : 'transform 0.05s'
          }}
        />
      </svg>

      <div className={styles.panDisplay}>
        <span className={styles.pos}>{posLabel}</span>
        <span className={styles.value}>{displayValue}</span>
      </div>
    </div>
  );
};

export default PanKnob;
EOF
  GENERATED_FILES+=("${OUTPUT_DIR}/PanKnob.tsx")
  log_success "Generated: PanKnob.tsx"
}

generate_pan_knob_css() {
  cat > "${OUTPUT_DIR}/PanKnob.module.css" << 'EOF'
.panKnob {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: grab;
  user-select: none;
  padding: 2px;
  border-radius: 4px;
  transition: background 0.2s;
}

.panKnob:hover {
  background: rgba(166, 226, 46, 0.05);
}

.panKnob.dragging {
  cursor: grabbing;
  background: rgba(166, 226, 46, 0.1);
}

.label {
  font-size: 10px;
  color: var(--dm);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.knobSvg {
  transition: opacity 0.2s;
  filter: drop-shadow(0 0 2px rgba(166, 226, 46, 0.2));
}

.panKnob:hover .knobSvg {
  opacity: 0.9;
  filter: drop-shadow(0 0 4px rgba(166, 226, 46, 0.4));
}

.panDisplay {
  display: flex;
  gap: 4px;
  font-size: 9px;
  color: var(--tx);
  font-variant-numeric: tabular-nums;
}

.pos {
  color: var(--ac);
  font-weight: 600;
  width: 14px;
  text-align: center;
}

.value {
  color: var(--dm2);
}
EOF
  GENERATED_FILES+=("${OUTPUT_DIR}/PanKnob.module.css")
  log_success "Generated: PanKnob.module.css"
}

generate_send_fader() {
  cat > "${OUTPUT_DIR}/SendFader.tsx" << 'EOF'
import React from 'react';
import styles from './SendFader.module.css';

interface SendFaderProps {
  value: number; // 0 to 1 (0% to 100%)
  onChange: (value: number) => void;
  label: string; // "Reverb Send", "Delay Send", etc.
  disabled?: boolean;
}

/**
 * Send Fader Component
 * Controls send amount (0-100%) to effects (reverb, delay, etc.)
 * Visual feedback with percentage display
 */
export const SendFader: React.FC<SendFaderProps> = ({ 
  value = 0, 
  onChange, 
  label,
  disabled = false
}) => {
  return (
    <div className={styles.sendFader}>
      <label className={styles.label}>{label}</label>
      
      <input
        type="range"
        min="0"
        max="100"
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className={styles.faderInput}
        aria-label={label}
        disabled={disabled}
      />
      
      <div className={styles.sendValue}>
        {Math.round(value * 100)}%
      </div>
    </div>
  );
};

export default SendFader;
EOF
  GENERATED_FILES+=("${OUTPUT_DIR}/SendFader.tsx")
  log_success "Generated: SendFader.tsx"
}

generate_send_fader_css() {
  cat > "${OUTPUT_DIR}/SendFader.module.css" << 'EOF'
.sendFader {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}

.label {
  font-size: 9px;
  color: var(--dm);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.faderInput {
  width: 100%;
  height: 4px;
  background: linear-gradient(to right, var(--ln2), var(--ac2));
  border: 1px solid var(--ln);
  border-radius: 2px;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
}

.faderInput:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.faderInput::-webkit-slider-thumb {
  appearance: none;
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--ac);
  border: 1px solid var(--ac2);
  cursor: grab;
  box-shadow: 0 0 6px rgba(166, 226, 46, 0.4);
  transition: transform 0.1s;
}

.faderInput::-webkit-slider-thumb:active {
  cursor: grabbing;
  transform: scale(1.1);
}

.faderInput::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--ac);
  border: 1px solid var(--ac2);
  cursor: grab;
  box-shadow: 0 0 6px rgba(166, 226, 46, 0.4);
  transition: transform 0.1s;
}

.faderInput::-moz-range-thumb:active {
  cursor: grabbing;
  transform: scale(1.1);
}

.sendValue {
  font-size: 9px;
  color: var(--dm2);
  text-align: center;
  font-variant-numeric: tabular-nums;
}
EOF
  GENERATED_FILES+=("${OUTPUT_DIR}/SendFader.module.css")
  log_success "Generated: SendFader.module.css"
}

phase_2_generate() {
  log_section "PHASE 2: GENERATING MIXER CONTROLS"
  log_info "Components: PanKnob, SendFader"
  log_info "Effort: 4-5 hours | Coverage: 65-75%"
  
  generate_pan_knob
  generate_pan_knob_css
  generate_send_fader
  generate_send_fader_css
  
  log_success "Phase 2: Generated 4 files"
}

################################################################################
# PHASE 3: DSP PLUGIN EDITOR (8-10 hours)
################################################################################

generate_parameter_knob() {
  cat > "${OUTPUT_DIR}/ParameterKnob.tsx" << 'EOF'
import React, { useState } from 'react';
import styles from './ParameterKnob.module.css';

interface ParameterKnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  onChange: (value: number) => void;
  disabled?: boolean;
}

/**
 * Parameter Knob Component
 * Visual knob for plugin parameters (threshold, ratio, attack, etc.)
 * Drag up/down to adjust, displays value + unit
 */
export const ParameterKnob: React.FC<ParameterKnobProps> = ({
  label,
  value,
  min,
  max,
  unit = '',
  onChange,
  disabled = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = () => {
    if (!disabled) setIsDragging(true);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || disabled) return;

    // Scale: negative movementY = increase value
    const range = max - min;
    const delta = (e.movementY * -1) * 0.5; // Drag up = increase
    const step = range / 100; // Scale to percentage
    const newValue = Math.max(min, Math.min(max, value + (step * (delta / 50))));
    onChange(newValue);
  };

  React.useEffect(() => {
    if (isDragging) {
      const handleMove = (e: MouseEvent) => handleMouseMove(e);
      const handleUp = () => setIsDragging(false);
      
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
      
      return () => {
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
      };
    }
  }, [isDragging, value, min, max]);

  const percentage = ((value - min) / (max - min)) * 100;
  const displayValue = value.toFixed(value < 100 ? 1 : 0);

  return (
    <div 
      className={`${styles.parameterKnob} ${isDragging ? styles.dragging : ''}`}
      role="slider"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-disabled={disabled}
    >
      <label className={styles.label}>{label}</label>
      
      <svg 
        className={styles.knobSvg}
        viewBox="0 0 64 64" 
        width="48" 
        height="48"
        onMouseDown={handleMouseDown}
        style={{ cursor: disabled ? 'not-allowed' : isDragging ? 'grabbing' : 'grab' }}
      >
        {/* Background circle */}
        <circle cx="32" cy="32" r="26" fill="none" stroke="var(--ln2)" strokeWidth="1" />
        
        {/* Value arc */}
        <circle 
          cx="32" 
          cy="32" 
          r="26" 
          fill="none" 
          stroke="var(--ac)" 
          strokeWidth="2"
          strokeDasharray={`${(percentage / 100) * 163} 163`}
          strokeLinecap="round"
          opacity="0.8"
        />
        
        {/* Pointer line */}
        <line
          x1="32"
          y1="6"
          x2="32"
          y2="14"
          stroke="var(--ac)"
          strokeWidth="2"
          strokeLinecap="round"
          style={{
            transform: `rotate(${225 + (percentage / 100) * 270}deg)`,
            transformOrigin: '32px 32px',
            transition: isDragging ? 'none' : 'transform 0.05s'
          }}
        />
      </svg>

      <div className={styles.paramDisplay}>
        <span className={styles.paramValue}>
          {displayValue}{unit}
        </span>
      </div>
    </div>
  );
};

export default ParameterKnob;
EOF
  GENERATED_FILES+=("${OUTPUT_DIR}/ParameterKnob.tsx")
  log_success "Generated: ParameterKnob.tsx"
}

generate_parameter_knob_css() {
  cat > "${OUTPUT_DIR}/ParameterKnob.module.css" << 'EOF'
.parameterKnob {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 8px;
  border-radius: 4px;
  background: linear-gradient(135deg, var(--p), var(--p2));
  border: 1px solid var(--ln);
  cursor: grab;
  user-select: none;
  transition: background 0.2s;
}

.parameterKnob:hover {
  background: linear-gradient(135deg, var(--p2), var(--p3));
}

.parameterKnob.dragging {
  background: linear-gradient(135deg, var(--p2), var(--p3));
  cursor: grabbing;
  box-shadow: inset 0 0 8px rgba(166, 226, 46, 0.2);
}

.label {
  font-size: 9px;
  font-weight: 600;
  color: var(--dm);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.knobSvg {
  user-select: none;
  transition: filter 0.2s;
}

.parameterKnob:hover .knobSvg {
  filter: drop-shadow(0 0 4px rgba(166, 226, 46, 0.3));
}

.paramDisplay {
  font-size: 10px;
  color: var(--tx);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.paramValue {
  color: var(--ac);
}
EOF
  GENERATED_FILES+=("${OUTPUT_DIR}/ParameterKnob.module.css")
  log_success "Generated: ParameterKnob.module.css"
}

generate_plugin_editor() {
  cat > "${OUTPUT_DIR}/PluginEditor.tsx" << 'EOF'
import React from 'react';
import { ParameterKnob } from './ParameterKnob';
import styles from './PluginEditor.module.css';

interface PluginEditorProps {
  plugin: any | null; // Plugin interface from store
  onParameterChange: (paramName: string, value: number) => void;
  onBypassToggle: () => void;
}

/**
 * Plugin Editor Component
 * Shows selected plugin parameters with knobs/sliders
 * Displays: Plugin name, bypass toggle, parameter controls, metering
 */
export const PluginEditor: React.FC<PluginEditorProps> = ({
  plugin,
  onParameterChange,
  onBypassToggle,
}) => {
  if (!plugin) {
    return (
      <div className={styles.pluginEditor}>
        <div className={styles.empty}>
          <p>Select a plugin to edit</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.pluginEditor}>
      <div className={styles.editorHeader}>
        <h3 className={styles.pluginName}>{plugin.name}</h3>
        <button 
          className={`btn ${plugin.bypassed ? 'on' : ''}`}
          onClick={onBypassToggle}
          title="Bypass plugin"
          aria-pressed={plugin.bypassed}
        >
          {plugin.bypassed ? 'BYPASSED' : 'ACTIVE'}
        </button>
      </div>

      <div className={styles.editorParams}>
        {/* R3 Compressor Parameters */}
        {plugin.type === 'compressor' && plugin.params && (
          <>
            <ParameterKnob
              label="Threshold"
              value={plugin.params.threshold || -20}
              min={-60}
              max={0}
              unit=" dB"
              onChange={(v) => onParameterChange('threshold', v)}
            />
            <ParameterKnob
              label="Ratio"
              value={plugin.params.ratio || 4}
              min={1}
              max={20}
              onChange={(v) => onParameterChange('ratio', v)}
            />
            <ParameterKnob
              label="Attack"
              value={plugin.params.attack || 10}
              min={0.1}
              max={1000}
              unit=" ms"
              onChange={(v) => onParameterChange('attack', v)}
            />
            <ParameterKnob
              label="Release"
              value={plugin.params.release || 100}
              min={10}
              max={5000}
              unit=" ms"
              onChange={(v) => onParameterChange('release', v)}
            />
            <ParameterKnob
              label="Makeup Gain"
              value={plugin.params.makeupGain || 0}
              min={-24}
              max={24}
              unit=" dB"
              onChange={(v) => onParameterChange('makeupGain', v)}
            />
            <ParameterKnob
              label="Knee"
              value={plugin.params.knee || 0}
              min={0}
              max={100}
              unit="%"
              onChange={(v) => onParameterChange('knee', v)}
            />
          </>
        )}

        {/* R3 EQ Parameters */}
        {plugin.type === 'eq' && plugin.params && (
          <>
            <ParameterKnob
              label="Low"
              value={plugin.params.low || 0}
              min={-24}
              max={24}
              unit=" dB"
              onChange={(v) => onParameterChange('low', v)}
            />
            <ParameterKnob
              label="Mid"
              value={plugin.params.mid || 0}
              min={-24}
              max={24}
              unit=" dB"
              onChange={(v) => onParameterChange('mid', v)}
            />
            <ParameterKnob
              label="High"
              value={plugin.params.high || 0}
              min={-24}
              max={24}
              unit=" dB"
              onChange={(v) => onParameterChange('high', v)}
            />
          </>
        )}
      </div>

      {plugin.metrics && (
        <div className={styles.editorMeters}>
          <div className={styles.meterGroup}>
            <label>Input</label>
            <div className={styles.meterDisplay}>
              {plugin.metrics.input?.toFixed(1) ?? '−∞'} dB
            </div>
          </div>
          <div className={styles.meterGroup}>
            <label>GR</label>
            <div className={styles.meterDisplay}>
              {plugin.metrics.gainReduction?.toFixed(1) ?? '0.0'} dB
            </div>
          </div>
          <div className={styles.meterGroup}>
            <label>Output</label>
            <div className={styles.meterDisplay}>
              {plugin.metrics.output?.toFixed(1) ?? '−∞'} dB
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PluginEditor;
EOF
  GENERATED_FILES+=("${OUTPUT_DIR}/PluginEditor.tsx")
  log_success "Generated: PluginEditor.tsx"
}

generate_plugin_editor_css() {
  cat > "${OUTPUT_DIR}/PluginEditor.module.css" << 'EOF'
.pluginEditor {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--ln);
  border-radius: 7px;
  background: linear-gradient(180deg, var(--p2), var(--p));
  min-height: 200px;
}

.empty {
  display: grid;
  place-items: center;
  flex: 1;
  color: var(--dm);
}

.empty p {
  margin: 0;
  font-size: 11px;
}

.editorHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid var(--ln);
  padding-bottom: 8px;
}

.pluginName {
  font-size: 12px;
  font-weight: 600;
  color: var(--ac);
  margin: 0;
  flex: 1;
}

.editorHeader .btn {
  padding: 3px 8px;
  font-size: 9px;
}

.editorParams {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(60px, 1fr));
  gap: 8px;
}

.editorMeters {
  display: flex;
  gap: 12px;
  border-top: 1px solid var(--ln);
  padding-top: 8px;
  justify-content: space-around;
}

.meterGroup {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.meterGroup label {
  font-size: 8px;
  color: var(--dm);
  font-weight: 600;
  text-transform: uppercase;
}

.meterDisplay {
  font-size: 9px;
  font-variant-numeric: tabular-nums;
  color: var(--ac);
  font-weight: 600;
}
EOF
  GENERATED_FILES+=("${OUTPUT_DIR}/PluginEditor.module.css")
  log_success "Generated: PluginEditor.module.css"
}

phase_3_generate() {
  log_section "PHASE 3: GENERATING DSP PLUGIN EDITOR"
  log_info "Components: ParameterKnob, PluginEditor"
  log_info "Effort: 3-4 hours | Coverage: 75-85%"
  
  generate_parameter_knob
  generate_parameter_knob_css
  generate_plugin_editor
  generate_plugin_editor_css
  
  log_success "Phase 3: Generated 4 files"
}

################################################################################
# PHASE 4: AUTOMATION & MARKERS (6-8 hours)
################################################################################

phase_4_generate() {
  log_section "PHASE 4: GENERATING AUTOMATION & MARKERS"
  log_info "Components: AutomationLane (editable points), ArrangeMarkers"
  log_info "Effort: 2-3 hours | Coverage: 85-92%"
  
  # Generate automation lane component
  cat > "${OUTPUT_DIR}/AutomationLane.tsx" << 'EOF'
import React from 'react';
import styles from './AutomationLane.module.css';

interface AutomationPoint {
  time: number;
  value: number;
}

interface AutomationLaneProps {
  automationId: string;
  parameter: string;
  points: AutomationPoint[];
  onPointCreate: (time: number, value: number) => void;
  onPointUpdate: (index: number, time: number, value: number) => void;
  onPointDelete: (index: number) => void;
  pixelsPerSecond: number;
  height?: number;
}

/**
 * Automation Lane Component
 * Shows editable automation points for parameters
 * Double-click to create, drag to edit, right-click to delete
 */
export const AutomationLane: React.FC<AutomationLaneProps> = ({
  automationId,
  parameter,
  points = [],
  onPointCreate,
  onPointUpdate,
  onPointDelete,
  pixelsPerSecond = 100,
  height = 60,
}) => {
  const [draggedPoint, setDraggedPoint] = React.useState<number | null>(null);

  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const time = (e.clientX - rect.left) / pixelsPerSecond;
    const value = 1 - (e.clientY - rect.top) / height;
    onPointCreate(Math.max(0, time), Math.max(0, Math.min(1, value)));
  };

  const handlePointMouseDown = (index: number) => {
    setDraggedPoint(index);
  };

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggedPoint === null) return;
      
      const point = points[draggedPoint];
      if (!point) return;

      const container = document.querySelector(`[data-automation="${automationId}"]`);
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const newTime = Math.max(0, (e.clientX - rect.left) / pixelsPerSecond);
      const newValue = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / height));
      
      onPointUpdate(draggedPoint, newTime, newValue);
    };

    const handleMouseUp = () => setDraggedPoint(null);

    if (draggedPoint !== null) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggedPoint, points, pixelsPerSecond, height, automationId]);

  return (
    <div
      className={styles.automationLane}
      data-automation={automationId}
      data-parameter={parameter}
      style={{ height: `${height}px` }}
      onDoubleClick={handleCanvasDoubleClick}
      role="region"
      aria-label={`Automation lane: ${parameter}`}
    >
      <div className={styles.grid}>
        {/* Horizontal grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <div
            key={v}
            className={styles.gridLine}
            style={{ bottom: `${v * 100}%` }}
          />
        ))}
      </div>

      {/* Automation curve (line connecting points) */}
      {points.length > 0 && (
        <svg className={styles.curve}>
          <polyline
            points={points
              .map((p) => `${p.time * pixelsPerSecond},${height - p.value * height}`)
              .join(' ')}
          />
        </svg>
      )}

      {/* Automation points (draggable) */}
      {points.map((point, index) => (
        <div
          key={index}
          className={`${styles.point} ${draggedPoint === index ? styles.dragging : ''}`}
          style={{
            left: `${point.time * pixelsPerSecond}px`,
            bottom: `${point.value * 100}%`,
          }}
          onMouseDown={() => handlePointMouseDown(index)}
          onContextMenu={(e) => {
            e.preventDefault();
            onPointDelete(index);
          }}
          role="button"
          tabIndex={0}
          aria-label={`Automation point ${index + 1}: ${(point.value * 100).toFixed(0)}%`}
          title="Drag to adjust · Right-click to delete"
        />
      ))}
    </div>
  );
};

export default AutomationLane;
EOF
  GENERATED_FILES+=("${OUTPUT_DIR}/AutomationLane.tsx")
  log_success "Generated: AutomationLane.tsx"

  cat > "${OUTPUT_DIR}/AutomationLane.module.css" << 'EOF'
.automationLane {
  position: relative;
  width: 100%;
  border: 1px solid var(--ln);
  border-radius: 4px;
  background: linear-gradient(180deg, var(--p), var(--p2));
  overflow: hidden;
  cursor: crosshair;
}

.grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.gridLine {
  position: absolute;
  width: 100%;
  height: 1px;
  background: var(--ln2);
  opacity: 0.3;
}

.gridLine:nth-child(3) {
  opacity: 0.6;
}

.curve {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.curve polyline {
  fill: none;
  stroke: var(--ac2);
  stroke-width: 2;
  opacity: 0.6;
}

.point {
  position: absolute;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--ac);
  border: 1px solid var(--ac2);
  box-shadow: 0 0 4px rgba(166, 226, 46, 0.6);
  cursor: grab;
  transform: translate(-50%, 50%);
  transition: transform 0.1s;
}

.point:hover {
  transform: translate(-50%, 50%) scale(1.2);
  box-shadow: 0 0 8px rgba(166, 226, 46, 0.8);
}

.point.dragging {
  cursor: grabbing;
  transform: translate(-50%, 50%) scale(1.3);
}
EOF
  GENERATED_FILES+=("${OUTPUT_DIR}/AutomationLane.module.css")
  log_success "Generated: AutomationLane.module.css"

  # Generate markers component
  cat > "${OUTPUT_DIR}/ArrangeMarkers.tsx" << 'EOF'
import React from 'react';
import styles from './ArrangeMarkers.module.css';

interface Marker {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  color?: string;
}

interface ArrangeMarkersProps {
  markers: Marker[];
  pixelsPerSecond: number;
  onMarkerCreate?: (time: number) => void;
  onMarkerDelete?: (id: string) => void;
}

/**
 * Arrange Markers Component
 * Displays section labels (Verse 1, Chorus, Bridge, etc.)
 * Shows as colored labels above timeline
 */
export const ArrangeMarkers: React.FC<ArrangeMarkersProps> = ({
  markers = [],
  pixelsPerSecond = 100,
  onMarkerCreate,
  onMarkerDelete,
}) => {
  return (
    <div className={styles.markersContainer} role="region" aria-label="Arrangement markers">
      {markers.map((marker) => {
        const left = marker.startTime * pixelsPerSecond;
        const width = marker.endTime
          ? (marker.endTime - marker.startTime) * pixelsPerSecond
          : undefined;

        return (
          <div
            key={marker.id}
            className={styles.markerLabel}
            style={{
              left: `${left}px`,
              width: width ? `${width}px` : 'auto',
              borderLeftColor: marker.color || 'var(--ac)',
            }}
            role="button"
            tabIndex={0}
            onContextMenu={(e) => {
              e.preventDefault();
              onMarkerDelete?.(marker.id);
            }}
          >
            <span className={styles.markerText}>{marker.name}</span>
          </div>
        );
      })}
    </div>
  );
};

export default ArrangeMarkers;
EOF
  GENERATED_FILES+=("${OUTPUT_DIR}/ArrangeMarkers.tsx")
  log_success "Generated: ArrangeMarkers.tsx"

  cat > "${OUTPUT_DIR}/ArrangeMarkers.module.css" << 'EOF'
.markersContainer {
  position: relative;
  width: 100%;
  height: 20px;
  background: linear-gradient(180deg, var(--p3), var(--p2));
  border-bottom: 1px solid var(--ln);
  overflow: hidden;
}

.markerLabel {
  position: absolute;
  top: 0;
  height: 100%;
  border-left: 3px solid var(--ac);
  padding-left: 4px;
  display: flex;
  align-items: center;
  font-size: 9px;
  color: var(--tx);
  font-weight: 500;
  pointer-events: auto;
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;
}

.markerLabel:hover {
  background: rgba(166, 226, 46, 0.1);
}

.markerText {
  white-space: nowrap;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}
EOF
  GENERATED_FILES+=("${OUTPUT_DIR}/ArrangeMarkers.module.css")
  log_success "Generated: ArrangeMarkers.module.css"
  
  log_success "Phase 4: Generated 4 files"
}

################################################################################
# PHASE 5: STATUS BAR & FOOTER (4-6 hours)
################################################################################

phase_5_generate() {
  log_section "PHASE 5: GENERATING STATUS BAR & FOOTER"
  log_info "Components: StatusBar, Footer"
  log_info "Effort: 1-2 hours | Coverage: 92-98%"
  
  cat > "${OUTPUT_DIR}/StatusBar.tsx" << 'EOF'
import React from 'react';
import styles from './StatusBar.module.css';

interface StatusBarProps {
  isRendering: boolean;
  audioEngineStatus: 'online' | 'offline' | 'suspended';
  midiRoutingValid: boolean;
  canExport: boolean;
}

/**
 * Status Bar Component
 * Shows: Render status, Audio engine state, MIDI routing, Export readiness
 * Located between header and main content area
 */
export const StatusBar: React.FC<StatusBarProps> = ({
  isRendering = false,
  audioEngineStatus = 'offline',
  midiRoutingValid = true,
  canExport = false,
}) => {
  return (
    <div className={styles.statusBar} role="status" aria-live="polite">
      <div className={styles.statusItem}>
        <span className={`${styles.indicator} ${isRendering ? styles.active : ''}`} />
        {isRendering ? 'Rendering...' : 'Ready'}
      </div>

      <div className={styles.statusItem}>
        Audio engine: <strong>{audioEngineStatus}</strong>
      </div>

      <div className={styles.statusItem}>
        <span className={`${styles.indicator} ${midiRoutingValid ? styles.valid : styles.invalid}`} />
        MIDI – {midiRoutingValid ? 'Routing valid' : 'Routing error'}
      </div>

      <div className={styles.statusItem}>
        <span className={`${styles.indicator} ${canExport ? styles.active : ''}`} />
        {canExport ? 'Export ready' : 'Cannot export'}
      </div>
    </div>
  );
};

export default StatusBar;
EOF
  GENERATED_FILES+=("${OUTPUT_DIR}/StatusBar.tsx")
  log_success "Generated: StatusBar.tsx"

  cat > "${OUTPUT_DIR}/StatusBar.module.css" << 'EOF'
.statusBar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 14px;
  height: 26px;
  background: linear-gradient(180deg, var(--p2), var(--p));
  border-top: 1px solid var(--ln);
  border-bottom: 1px solid var(--ln);
  font-size: 10px;
  color: var(--dm);
  font-variant-numeric: tabular-nums;
}

.statusItem {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.statusItem strong {
  color: var(--tx);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ln2);
  box-shadow: inset 0 0 2px rgba(0, 0, 0, 0.5);
  flex-shrink: 0;
}

.indicator.active {
  background: var(--ac);
  box-shadow: 0 0 4px var(--ac);
  animation: pulse 1s infinite;
}

.indicator.valid {
  background: var(--ac);
  box-shadow: 0 0 4px var(--ac);
}

.indicator.invalid {
  background: var(--err);
  box-shadow: 0 0 4px var(--err);
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}
EOF
  GENERATED_FILES+=("${OUTPUT_DIR}/StatusBar.module.css")
  log_success "Generated: StatusBar.module.css"

  cat > "${OUTPUT_DIR}/Footer.tsx" << 'EOF'
import React from 'react';
import styles from './Footer.module.css';

interface FooterProps {
  deviceName: string;
  sampleRate: number;
  bitDepth: number;
  latency: number;
  bufferSize: number;
}

/**
 * Footer Component
 * Shows: Audio device, sample rate, bit depth, latency, buffer size
 * Located at bottom of window
 */
export const Footer: React.FC<FooterProps> = ({ 
  deviceName = 'Default',
  sampleRate = 44100,
  bitDepth = 24,
  latency = 16,
  bufferSize = 512,
}) => {
  return (
    <footer className={styles.footer} role="contentinfo">
      <div className={styles.footerItem}>
        Device – <strong>{deviceName}</strong>
      </div>
      <div className={styles.footerItem}>
        Renderer: <strong>{(sampleRate / 1000).toFixed(1)} kHz / {bitDepth} bit</strong>
      </div>
      <div className={styles.footerItem}>
        Buffer – <strong>{bufferSize}</strong> latency – <strong>{latency.toFixed(1)} ms</strong>/native
      </div>
    </footer>
  );
};

export default Footer;
EOF
  GENERATED_FILES+=("${OUTPUT_DIR}/Footer.tsx")
  log_success "Generated: Footer.tsx"

  cat > "${OUTPUT_DIR}/Footer.module.css" << 'EOF'
.footer {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 14px;
  height: 32px;
  background: linear-gradient(180deg, var(--p2), var(--p));
  border-top: 1px solid var(--ln);
  font-size: 10px;
  color: var(--dm);
  font-variant-numeric: tabular-nums;
}

.footerItem {
  display: flex;
  gap: 4px;
  white-space: nowrap;
  align-items: center;
}

.footerItem strong {
  color: var(--tx);
  font-weight: 600;
}
EOF
  GENERATED_FILES+=("${OUTPUT_DIR}/Footer.module.css")
  log_success "Generated: Footer.module.css"
  
  log_success "Phase 5: Generated 4 files"
}

################################################################################
# DEPLOYMENT FUNCTIONS
################################################################################

deploy_files() {
  local phase="$1"
  
  log_section "DEPLOYING PHASE $phase FILES"
  
  # Create component directory if needed
  mkdir -p "$COMPONENTS_DIR" "$STYLES_DIR"
  
  # Find component files from current phase
  local pattern=""
  case "$phase" in
    1) pattern="HeaderBrand|ClockDisplay" ;;
    2) pattern="PanKnob|SendFader" ;;
    3) pattern="ParameterKnob|PluginEditor" ;;
    4) pattern="AutomationLane|ArrangeMarkers" ;;
    5) pattern="StatusBar|Footer" ;;
    *) pattern="*" ;;
  esac
  
  # Copy TSX files
  for file in "${OUTPUT_DIR}"/*.tsx; do
    if [[ "$(basename $file)" =~ $pattern ]]; then
      backup_file "$COMPONENTS_DIR/$(basename $file)"
      cp "$file" "$COMPONENTS_DIR/"
      DEPLOYED_FILES+=("$file")
      log_success "Deployed: $(basename $file)"
    fi
  done
  
  # Copy CSS files
  for file in "${OUTPUT_DIR}"/*.css; do
    if [[ "$(basename $file)" =~ $pattern ]]; then
      backup_file "$COMPONENTS_DIR/$(basename $file)"
      cp "$file" "$COMPONENTS_DIR/"
      DEPLOYED_FILES+=("$file")
      log_success "Deployed: $(basename $file)"
    fi
  done
}

################################################################################
# VALIDATION FUNCTIONS
################################################################################

validate_phase() {
  local phase="$1"
  
  log_section "VALIDATING PHASE $phase"
  
  case "$phase" in
    1)
      log_info "Checking header components..."
      [ -f "$COMPONENTS_DIR/HeaderBrand.tsx" ] && log_success "✓ HeaderBrand.tsx" || log_error "✗ HeaderBrand.tsx"
      [ -f "$COMPONENTS_DIR/ClockDisplay.tsx" ] && log_success "✓ ClockDisplay.tsx" || log_error "✗ ClockDisplay.tsx"
      ;;
    2)
      log_info "Checking mixer controls..."
      [ -f "$COMPONENTS_DIR/PanKnob.tsx" ] && log_success "✓ PanKnob.tsx" || log_error "✗ PanKnob.tsx"
      [ -f "$COMPONENTS_DIR/SendFader.tsx" ] && log_success "✓ SendFader.tsx" || log_error "✗ SendFader.tsx"
      ;;
    3)
      log_info "Checking DSP editor..."
      [ -f "$COMPONENTS_DIR/ParameterKnob.tsx" ] && log_success "✓ ParameterKnob.tsx" || log_error "✗ ParameterKnob.tsx"
      [ -f "$COMPONENTS_DIR/PluginEditor.tsx" ] && log_success "✓ PluginEditor.tsx" || log_error "✗ PluginEditor.tsx"
      ;;
    4)
      log_info "Checking automation..."
      [ -f "$COMPONENTS_DIR/AutomationLane.tsx" ] && log_success "✓ AutomationLane.tsx" || log_error "✗ AutomationLane.tsx"
      [ -f "$COMPONENTS_DIR/ArrangeMarkers.tsx" ] && log_success "✓ ArrangeMarkers.tsx" || log_error "✗ ArrangeMarkers.tsx"
      ;;
    5)
      log_info "Checking status/footer..."
      [ -f "$COMPONENTS_DIR/StatusBar.tsx" ] && log_success "✓ StatusBar.tsx" || log_error "✗ StatusBar.tsx"
      [ -f "$COMPONENTS_DIR/Footer.tsx" ] && log_success "✓ Footer.tsx" || log_error "✗ Footer.tsx"
      ;;
  esac
}

################################################################################
# ORCHESTRATION COMMANDS
################################################################################

execute_phase() {
  local phase="$1"
  
  log_section "EXECUTING PHASE $phase"
  
  case "$phase" in
    1) phase_1_generate ;;
    2) phase_2_generate ;;
    3) phase_3_generate ;;
    4) phase_4_generate ;;
    5) phase_5_generate ;;
    *) log_error "Unknown phase: $phase"; return 1 ;;
  esac
  
  if [ "$CLIENT_SRC" != "." ]; then
    deploy_files "$phase"
    validate_phase "$phase"
  fi
}

execute_all() {
  log_section "EXECUTING FULL PIPELINE (ALL 5 PHASES)"
  
  for phase in {1..5}; do
    execute_phase "$phase"
  done
  
  log_success "All phases complete!"
}

show_summary() {
  log_section "EXECUTION SUMMARY"
  
  log_info "Generated files: ${#GENERATED_FILES[@]}"
  for f in "${GENERATED_FILES[@]}"; do
    log_success "  • $(basename $f)"
  done
  
  if [ ${#DEPLOYED_FILES[@]} -gt 0 ]; then
    log_info ""
    log_info "Deployed files: ${#DEPLOYED_FILES[@]}"
    for f in "${DEPLOYED_FILES[@]}"; do
      log_success "  • $(basename $f)"
    done
  fi
  
  log_info ""
  log_info "Output directory: $OUTPUT_DIR"
  log_info "Backups directory: $BACKUP_DIR"
}

show_help() {
  cat << 'EOF'
Usage: bash MULTITRACK_AUTOMATION_MASTER.sh [phase] [action]

PHASES:
  1    Generate/deploy header components (bar/beat/tick, logo)
  2    Generate/deploy mixer controls (pan knobs, send faders)
  3    Generate/deploy DSP plugin editor (parameter knobs)
  4    Generate/deploy automation & markers (editable points, labels)
  5    Generate/deploy status bar & footer (render status, device info)
  all  Execute all 5 phases

ACTIONS:
  generate   Generate component files (no deployment)
  deploy     Deploy generated files to project
  validate   Validate deployed files
  execute    Generate + deploy + validate (default)

EXAMPLES:
  bash MULTITRACK_AUTOMATION_MASTER.sh 1 generate
  bash MULTITRACK_AUTOMATION_MASTER.sh 2 deploy
  bash MULTITRACK_AUTOMATION_MASTER.sh all execute
  bash MULTITRACK_AUTOMATION_MASTER.sh all validate

ENVIRONMENT:
  PROJECT_ROOT   Root directory of r3v4 project (default: .)
  CLIENT_SRC     Client source directory (default: ./client/src)

EOF
}

################################################################################
# MAIN
################################################################################

main() {
  local phase="${1:-}"
  local action="${2:-execute}"
  
  case "$phase" in
    --help|-h|help) show_help; exit 0 ;;
    "") show_help; exit 1 ;;
  esac
  
  verify_environment
  
  if [ "$phase" = "all" ]; then
    case "$action" in
      generate)
        for p in {1..5}; do
          phase_${p}_generate
        done
        ;;
      deploy)
        for p in {1..5}; do
          deploy_files "$p"
        done
        ;;
      validate)
        for p in {1..5}; do
          validate_phase "$p"
        done
        ;;
      execute|*)
        execute_all
        ;;
    esac
  else
    case "$action" in
      generate)
        execute_phase "$phase"
        ;;
      deploy)
        deploy_files "$phase"
        ;;
      validate)
        validate_phase "$phase"
        ;;
      execute|*)
        execute_phase "$phase"
        ;;
    esac
  fi
  
  show_summary
}

main "$@"
