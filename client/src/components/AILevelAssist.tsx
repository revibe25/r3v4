// ─────────────────────────────────────────────────────────────
// client/src/components/mixer/AILevelAssist.tsx
//
// The main UI component for AI Auto-Leveling in the mixer.
//
// Renders:
//   - "AI Level Assist" toggle button
//   - Per-track ghost knobs (shows AI-suggested gain position)
//   - Confidence badges (percentage per track)
//   - Accept / Reject buttons per suggestion
//   - Clipping indicators
//   - Live inference timing badge
// ─────────────────────────────────────────────────────────────

// ── RFC-EXEMPT: STATUS palette (§4.5) ────────────────────────────────────────
// Colors: var(--status-warn) (amber)
// Reason: AI warning state — directly adjacent to LLPTE pipeline output
// Approved: P2 remediation pass — see PRD §4.5 and tools/p2_patch.py
// ─────────────────────────────────────────────────────────────────────────────

import React, { memo, useMemo } from 'react';
import type { TrackId, TrackAILevelState, EQSuggestion } from '../../../shared/auto-level.types';
import type { PipelineNodeState } from '../../../packages/llpte-core/src/AutoLevelPipeline';

// ── Utility ────────────────────────────────────────────────────

/** Convert linear gain (0–4) to knob angle in degrees (−135° to +135°) */
function gainToAngle(linearGain: number): number {
  // Knob range: 0 to 2.0 linear (0 to +6dB)
  // Mapped to −135° (silence) to +135° (unity/boost)
  const normalized = Math.min(1, linearGain / 2);
  return -135 + normalized * 270;
}

/** Format gain in dB for display */
function gainTodB(linearGain: number): string {
  if (linearGain <= 0) return '-∞';
  const db = 20 * Math.log10(linearGain);
  return (db >= 0 ? '+' : '') + db.toFixed(1) + ' dB';
}

// ── Ghost Knob ─────────────────────────────────────────────────

interface GhostKnobProps {
  /** Current actual gain (linear) */
  currentGain: number;
  /** AI-suggested gain (linear) — null = no suggestion */
  suggestedGain: number | null;
  /** Confidence 0–1 */
  confidence: number | null;
  /** Is the track currently clipping? */
  isClipping: boolean;
  /** Is there an active user override? */
  userOverride: boolean;
  /** Diameter of the knob in px */
  size?: number;
}

export const GhostKnob = memo(function GhostKnob({
  currentGain,
  suggestedGain,
  confidence,
  isClipping,
  userOverride,
  size = 48,
}: GhostKnobProps) {
  const currentAngle = gainToAngle(currentGain);
  const suggestedAngle = suggestedGain !== null ? gainToAngle(suggestedGain) : null;

  const center = size / 2;
  const radius = (size / 2) - 4;
  const indicatorLength = radius * 0.55;

  // Indicator line for current position
  const currentRad = ((currentAngle - 90) * Math.PI) / 180;
  const currentX = center + Math.sin(currentRad) * indicatorLength;
  const currentY = center - Math.cos(currentRad) * indicatorLength;

  // Ghost indicator for AI suggestion
  let ghostX = 0, ghostY = 0;
  if (suggestedAngle !== null) {
    const ghostRad = ((suggestedAngle - 90) * Math.PI) / 180;
    ghostX = center + Math.sin(ghostRad) * indicatorLength;
    ghostY = center - Math.cos(ghostRad) * indicatorLength;
  }

  // Color theme
  const knobColor = isClipping ? '#ef4444' : userOverride ? 'var(--status-warn)' : 'var(--panel-deep)';
  const ghostOpacity = confidence !== null ? 0.3 + confidence * 0.5 : 0;
  const ghostColor = confidence !== null && confidence > 0.8 ? 'var(--accent-violet)' : 'var(--accent-indigo)';

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      title={suggestedGain !== null ? `AI suggests: ${gainTodB(suggestedGain)} (${Math.round((confidence ?? 0) * 100)}% confidence)` : undefined}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ overflow: 'visible' }}
      >
        {/* Knob track arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill={knobColor}
          stroke={isClipping ? '#ef4444' : 'var(--text-dim)'}
          strokeWidth={1.5}
        />

        {/* Ghost arc — shows AI suggestion range */}
        {suggestedAngle !== null && (
          <circle
            cx={center}
            cy={center}
            r={radius - 2}
            fill="none"
            stroke={ghostColor}
            strokeWidth={2}
            strokeDasharray="2 3"
            opacity={ghostOpacity}
          />
        )}

        {/* Ghost indicator line (AI suggested position) */}
        {suggestedAngle !== null && (
          <line
            x1={center}
            y1={center}
            x2={ghostX}
            y2={ghostY}
            stroke={ghostColor}
            strokeWidth={2}
            strokeLinecap="round"
            opacity={ghostOpacity + 0.2}
            style={{
              filter: confidence && confidence > 0.8 ? `drop-shadow(0 0 3px ${ghostColor})` : undefined,
            }}
          />
        )}

        {/* Current position indicator */}
        <line
          x1={center}
          y1={center}
          x2={currentX}
          y2={currentY}
          stroke="var(--text-primary)"
          strokeWidth={2.5}
          strokeLinecap="round"
        />

        {/* Center dot */}
        <circle cx={center} cy={center} r={2} fill="var(--slate-400)" />

        {/* Clipping ring */}
        {isClipping && (
          <circle
            cx={center}
            cy={center}
            r={radius + 2}
            fill="none"
            stroke="#ef4444"
            strokeWidth={2}
            opacity={0.8}
            style={{ animation: 'pulse 0.5s ease-in-out infinite' }}
          />
        )}
      </svg>
    </div>
  );
});

// ── Confidence Badge ────────────────────────────────────────────

interface ConfidenceBadgeProps {
  confidence: number;  // 0–1
}

export const ConfidenceBadge = memo(function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  const percent = Math.round(confidence * 100);
  const color =
    confidence >= 0.85 ? 'text-violet-400 border-violet-500/40 bg-violet-500/10' :
    confidence >= 0.65 ? 'text-blue-400 border-blue-500/40 bg-blue-500/10' :
                         'text-slate-400 border-slate-500/40 bg-slate-500/10';

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border ${color}`}
      title={`AI confidence: ${percent}%`}
    >
      {percent}%
    </span>
  );
});

// ── Track AI Level Card ─────────────────────────────────────────

interface TrackAICardProps {
  state: TrackAILevelState;
  onAccept: (trackId: TrackId) => void;
  onReject: (trackId: TrackId) => void;
}

export const TrackAICard = memo(function TrackAICard({ state, onAccept, onReject }: TrackAICardProps) {
  const hasSuggestion = state.suggestedGain !== null && !state.userOverride;

  return (
    <div
      className={`
        flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-all duration-300
        ${state.isClipping
          ? 'border-red-500/60 bg-red-500/5'
          : hasSuggestion
          ? 'border-violet-500/40 bg-violet-500/5'
          : 'border-white/5 bg-transparent'
        }
      `}
    >
      {/* Track ID */}
      <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest truncate w-full text-center">
        {state.trackId}
      </span>

      {/* Ghost Knob */}
      <GhostKnob
        currentGain={state.currentGain}
        suggestedGain={state.suggestedGain}
        confidence={state.confidence}
        isClipping={state.isClipping}
        userOverride={state.userOverride}
        size={44}
      />

      {/* Confidence badge */}
      {state.confidence !== null && !state.userOverride && (
        <ConfidenceBadge confidence={state.confidence} />
      )}

      {/* User override badge */}
      {state.userOverride && (
        <span className="text-[9px] text-amber-400/70 font-mono">MANUAL</span>
      )}

      {/* Accept / Reject controls */}
      {hasSuggestion && (
        <div className="flex gap-1 mt-0.5">
          <button
            onClick={() => onAccept(state.trackId)}
            className="px-2 py-0.5 text-[10px] font-medium rounded bg-violet-600/80 hover:bg-violet-600 text-foreground transition-colors"
            title="Accept AI suggestion"
          >
            ✓
          </button>
          <button
            onClick={() => onReject(state.trackId)}
            className="px-2 py-0.5 text-[10px] font-medium rounded bg-white/5 hover:bg-white/10 text-slate-400 transition-colors"
            title="Reject AI suggestion"
          >
            ✕
          </button>
        </div>
      )}

      {/* EQ suggestion pills */}
      {state.eqSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-1 justify-center">
          {state.eqSuggestions.slice(0, 2).map((eq, i) => (
            <EQPill key={i} suggestion={eq} />
          ))}
        </div>
      )}
    </div>
  );
});

// ── EQ Pill ────────────────────────────────────────────────────

interface EQPillProps {
  suggestion: EQSuggestion;
}

const EQPill = memo(function EQPill({ suggestion }: EQPillProps) {
  const label =
    suggestion.band === 'low'
      ? `LP ${suggestion.frequency.toFixed(0)}Hz`
      : suggestion.band === 'low-mid'
      ? `Cut ${suggestion.frequency.toFixed(0)}Hz`
      : suggestion.band === 'high-mid'
      ? `Cut ${suggestion.frequency.toFixed(0)}Hz`
      : `HS ${suggestion.frequency.toFixed(0)}Hz`;

  return (
    <span
      className="px-1.5 py-0.5 text-[9px] font-mono rounded border border-cyan-500/30 bg-cyan-500/10 text-cyan-400"
      title={suggestion.reason}
    >
      {label}
    </span>
  );
});

// ── LLPTE Node Graph Mini ───────────────────────────────────────

interface LLPTEStatusBarProps {
  nodeState: PipelineNodeState;
  enabled: boolean;
}

export const LLPTEStatusBar = memo(function LLPTEStatusBar({ nodeState, enabled }: LLPTEStatusBarProps) {
  const nodes = [
    { key: 'inputRouter', label: 'IN' },
    { key: 'spectralAnalyzer', label: 'SPEC' },
    { key: 'aiMixEngine', label: 'AI' },
    { key: 'transitionGraph', label: 'TRANS' },
    { key: 'outputBus', label: 'OUT' },
  ] as const;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background/40 border border-white/5">
      {nodes.map((node, i) => {
        const status = (nodeState as any)[node.key] as 'idle' | 'active' | 'error';
        return (
          <React.Fragment key={node.key}>
            <div
              className={`
                flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider transition-all duration-100
                ${!enabled ? 'text-slate-700' :
                  status === 'active' ? 'text-violet-300 bg-violet-500/20' :
                  status === 'error' ? 'text-red-400 bg-red-500/20' :
                  'text-slate-600'}
              `}
            >
              {/* Activity dot */}
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  !enabled ? 'bg-slate-800' :
                  status === 'active' ? 'bg-violet-400 shadow-[0_0_4px_var(--accent-violet)]' :
                  status === 'error' ? 'bg-red-400' :
                  'bg-slate-700'
                }`}
              />
              {node.label}
            </div>
            {i < nodes.length - 1 && (
              <span className={`text-[10px] ${enabled ? 'text-slate-600' : 'text-slate-800'}`}>→</span>
            )}
          </React.Fragment>
        );
      })}

      {/* Inference timing */}
      <div className="ml-2 pl-2 border-l border-white/10 flex items-center gap-1.5">
        <span className={`text-[9px] font-mono ${
          nodeState.lastInferenceMs > 12 ? 'text-amber-400' : 'text-slate-500'
        }`}>
          {nodeState.lastInferenceMs.toFixed(1)}ms
        </span>
        <span className="text-[9px] font-mono text-slate-700">
          {nodeState.analysisFrameRate}fps
        </span>
      </div>
    </div>
  );
});

// ── Main AILevelAssist Component ────────────────────────────────

interface AILevelAssistProps {
  enabled: boolean;
  onToggle: () => void;
  trackStates: Map<TrackId, TrackAILevelState>;
  onAccept: (trackId: TrackId) => void;
  onReject: (trackId: TrackId) => void;
  nodeState: PipelineNodeState;
  /** Only show tracks present in this ordered array */
  trackOrder?: TrackId[];
  /** Compact mode — hides EQ pills and labels for tight mixer layout */
  compact?: boolean;
}

export const AILevelAssist = memo(function AILevelAssist({
  enabled,
  onToggle,
  trackStates,
  onAccept,
  onReject,
  nodeState,
  trackOrder,
  _compact = false,
}: AILevelAssistProps) {
  const orderedTracks = useMemo(() => {
    const ids = trackOrder ?? Array.from(trackStates.keys());
    return ids.map(id => trackStates.get(id)).filter(Boolean) as TrackAILevelState[];
  }, [trackStates, trackOrder]);

  const activeSuggestions = orderedTracks.filter(t => t.suggestedGain !== null && !t.userOverride).length;
  const clippingCount = orderedTracks.filter(t => t.isClipping).length;

  return (
    <div className="flex flex-col gap-2">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onToggle}
          className={`
            flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200
            ${enabled
              ? 'bg-violet-600 text-foreground shadow-[0_0_12px_rgba(139,92,246,0.4)]'
              : 'bg-white/5 text-slate-400 hover:bg-white/10'
            }
          `}
        >
          {/* AI icon */}
          <span className={`text-sm ${enabled ? 'text-violet-200' : 'text-slate-500'}`}>⚡</span>
          AI Level Assist
          {enabled && activeSuggestions > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-violet-400/30 text-violet-200 text-[10px]">
              {activeSuggestions}
            </span>
          )}
        </button>

        {/* Clipping warning */}
        {clippingCount > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-red-500/10 border border-red-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            <span className="text-[10px] font-mono text-red-400">
              {clippingCount} CLIP{clippingCount > 1 ? 'S' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Track cards grid */}
      {enabled && orderedTracks.length > 0 && (
        <div
          className="grid gap-1.5"
          style={{ gridTemplateColumns: `repeat(${Math.min(orderedTracks.length, 8)}, minmax(0, 1fr))` }}
        >
          {orderedTracks.map(trackState => (
            <TrackAICard
              key={trackState.trackId}
              state={trackState}
              onAccept={onAccept}
              onReject={onReject}
            />
          ))}
        </div>
      )}

      {/* LLPTE node graph status bar */}
      {enabled && (
        <LLPTEStatusBar nodeState={nodeState} enabled={enabled} />
      )}
    </div>
  );
});

// CSS animation for clipping ring — add to your global CSS:
// @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
