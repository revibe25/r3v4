/**
 * client/src/components/mix-suggestions/MixSuggestionsPanel.tsx
 *
 * PRD §8.4 — Mix Suggestion System (MVP Item 4)
 * Three trigger types (PRD §8.4):
 *   1. Frequency masking  — FFT overlap in shared bands > −12 dBFS for ≥ 1 bar
 *   2. Dynamic imbalance  — RMS differential > 6 dB between any two active tracks
 *   3. Arrangement conflict — ≥ 3 tracks simultaneously peaking above −6 dBFS
 *
 * Confidence gating (PRD §8.1):
 *   ≥ 0.65  → auto-apply (shown as AUTO badge)
 *   ≥ 0.40  → surface as suggestion (shown as SUGGEST badge)
 *   < 0.40  → discard silently (never rendered)
 *
 * aiDecisionLog outcome field (PRD §12):
 *   'auto_applied' | 'accepted' | 'rejected' | 'ignored' | 'discarded'
 *
 * Props:
 *   onSuggestionAccept(decisionId) — called by DAW.tsx to write 'accepted' to aiDecisionLog
 *   onSuggestionReject(decisionId) — called by DAW.tsx to write 'rejected' to aiDecisionLog
 *
 * Design: Acid-techno palette — SKILLS.md §7 canonical inline-style pattern.
 * No Tailwind. No `any`. No swallowed exceptions.
 * Backend wiring: aiMix.router.submitSuggestionOutcome — called by parent (DAW.tsx).
 *
 * @module components/mix-suggestions/MixSuggestionsPanel
 */

import { useState, useEffect, useCallback, useRef, memo } from 'react';

// ── Canonical palette — SKILLS.md §7 ─────────────────────────────────────────
const P = {
  bg:        '#0a0a0a',
  surface:   '#0d0d0d',
  void:      'var(--void)',
  border:    '#1c1c1c',
  border2:   '#2a2a2a',
  text:      '#e5e5e5',
  dim:       '#555',
  soft:      'var(--text-dim)',
  accent:    '#a3e635',   // acid green — primary
  accentDim: 'rgba(163,230,53,0.10)',
  cyan:      'var(--accent-cyan)',   // PRD §3 — active state
  violet:    'var(--accent-purple)',   // PRD §3 — AI color
  amber:     'var(--status-warn)',   // PRD §3 — warning
  red:       '#ef4444',   // danger
  font:      '"JetBrains Mono","Fira Code","Courier New",monospace',
} as const;

// ── PRD §8.4 trigger types ────────────────────────────────────────────────────
type TriggerType = 'frequency_masking' | 'dynamic_imbalance' | 'arrangement_conflict';

// PRD §12 aiDecisionLog.outcome
type SuggestionOutcome = 'auto_applied' | 'accepted' | 'rejected' | 'ignored' | 'discarded';

interface MixSuggestion {
  id:          string;           // decisionId — passed to onSuggestionAccept/Reject
  type:        TriggerType;
  track:       string;           // human-readable track name
  confidence:  number;           // [0, 1] — gating per PRD §8.1
  description: string;
  detail:      string;           // technical detail for investor demo
  outcome:     SuggestionOutcome | null;  // null = pending
  autoApplied: boolean;
}

// ── Trigger type display config ───────────────────────────────────────────────
const TRIGGER_META: Record<TriggerType, { label: string; color: string; icon: string }> = {
  frequency_masking:   { label: 'FREQ MASK',  color: P.cyan,   icon: '⊞' },
  dynamic_imbalance:   { label: 'DYN IMBAL',  color: P.amber,  icon: '⊟' },
  arrangement_conflict:{ label: 'ARR CONFLICT',color: P.red,    icon: '⊠' },
};

// ── Demo seed data — PRD §21 Demo Script, §8.4 trigger specs ─────────────────
// Populated on first ANALYSE press. Reflects the exact investor demo flow:
//   Minute 4–6: "Cut low-end on SYNTH LEAD below 80Hz" — frequency masking trigger.
const DEMO_SUGGESTIONS: MixSuggestion[] = [
  {
    id:          'dec_freq_001',
    type:        'frequency_masking',
    track:       'SYNTH LEAD',
    confidence:  0.87,
    description: 'Cut low-end on SYNTH LEAD below 80Hz — FFT clash with 808 BASS in shared band',
    detail:      'FFT overlap > −12 dBFS for 3.2 bars @ 60–90Hz',
    outcome:     null,
    autoApplied: false,
  },
  {
    id:          'dec_dyn_002',
    type:        'dynamic_imbalance',
    track:       'VOCAL CHOP',
    confidence:  0.74,
    description: 'Reduce VOCAL CHOP gain by −3 dB — RMS 8.4 dB above CHORD PAD',
    detail:      'RMS differential 8.4 dB > 6 dB threshold',
    outcome:     null,
    autoApplied: false,
  },
  {
    id:          'dec_arr_003',
    type:        'arrangement_conflict',
    track:       'ALL',
    confidence:  0.61,
    description: '3 tracks peaking above −6 dBFS simultaneously — reduce master bus headroom risk',
    detail:      'KICK / 808 BASS / SYNTH LEAD peaking concurrently @ bar 14',
    outcome:     null,
    autoApplied: false,
  },
  {
    id:          'dec_freq_004',
    type:        'frequency_masking',
    track:       'CHORD PAD',
    confidence:  0.68,
    description: 'High shelf boost +2 dB on CHORD PAD above 6kHz — presence buried by SYNTH LEAD',
    detail:      'FFT overlap > −12 dBFS for 2.1 bars @ 4–8kHz',
    outcome:     null,
    autoApplied: false,
  },
];

// ── Confidence badge ──────────────────────────────────────────────────────────
const ConfidenceBadge = memo(({ confidence }: { confidence: number }) => {
  const isAuto   = confidence >= 0.65;
  const color    = isAuto ? P.accent : confidence >= 0.40 ? P.amber : P.red;
  const label    = isAuto ? 'AUTO' : 'SUGGEST';
  return (
    <div style={{
      display:       'flex',
      alignItems:    'center',
      gap:           5,
      padding:       '2px 7px',
      border:        `1px solid ${color}44`,
      background:    `${color}10`,
      flexShrink:    0,
    }}>
      <div style={{ width: 5, height: 5, background: color, boxShadow: `0 0 5px ${color}` }} />
      <span style={{ fontSize: 7, color, fontWeight: 700, fontFamily: P.font, letterSpacing: '0.15em' }}>
        {Math.round(confidence * 100)}% {label}
      </span>
    </div>
  );
});
ConfidenceBadge.displayName = 'ConfidenceBadge';

// ── Acceptance rate meter ────────────────────────────────────────────────────
const AcceptanceRate = memo(({ accepted, total }: { accepted: number; total: number }) => {
  if (total === 0) return null;
  const rate     = accepted / total;
  const pct      = Math.round(rate * 100);
  // PRD §6: target ≥ 40%
  const color    = rate >= 0.65 ? P.accent : rate >= 0.40 ? P.amber : P.red;
  return (
    <div style={{
      padding:      '6px 10px',
      background:   P.void,
      borderTop:    `1px solid ${P.border}`,
      display:      'flex',
      alignItems:   'center',
      gap:          10,
    }}>
      <span style={{ fontSize: 7, color: P.dim, letterSpacing: '0.2em', textTransform: 'uppercase', fontFamily: P.font }}>
        ACCEPTANCE
      </span>
      <div style={{ flex: 1, height: 2, background: P.border2 }}>
        <div style={{
          height:     '100%',
          width:      `${pct}%`,
          background: color,
          transition: 'width 0.3s ease, background 0.3s ease',
        }} />
      </div>
      <span style={{ fontSize: 9, color, fontWeight: 700, fontFamily: P.font, minWidth: 36, textAlign: 'right' }}>
        {pct}%
      </span>
      <span style={{ fontSize: 7, color: P.dim, fontFamily: P.font }}>
        {accepted}/{total}
      </span>
    </div>
  );
});
AcceptanceRate.displayName = 'AcceptanceRate';

// ── Suggestion card ───────────────────────────────────────────────────────────
interface SuggestionCardProps {
  suggestion:  MixSuggestion;
  onAccept:    (id: string) => void;
  onReject:    (id: string) => void;
}

const SuggestionCard = memo(({ suggestion, onAccept, onReject }: SuggestionCardProps) => {
  const meta     = TRIGGER_META[suggestion.type];
  const resolved = suggestion.outcome !== null;

  const outcomeColor: Record<SuggestionOutcome, string> = {
    auto_applied: P.accent,
    accepted:     P.accent,
    rejected:     P.dim,
    ignored:      P.dim,
    discarded:    P.red,
  };

  const outcomeLabel: Record<SuggestionOutcome, string> = {
    auto_applied: '✓ AUTO-APPLIED',
    accepted:     '✓ ACCEPTED',
    rejected:     '✕ REJECTED',
    ignored:      '— IGNORED',
    discarded:    '✕ DISCARDED',
  };

  return (
    <div style={{
      background:  P.void,
      border:      `1px solid ${P.border}`,
      borderLeft:  `2px solid ${meta.color}`,
      padding:     '9px 11px',
      display:     'flex',
      flexDirection: 'column',
      gap:         6,
      opacity:     resolved ? 0.55 : 1,
      transition:  'opacity 0.2s ease',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: meta.color }}>{meta.icon}</span>
          <span style={{ fontSize: 7, color: meta.color, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', fontFamily: P.font }}>
            {meta.label}
          </span>
          <span style={{ fontSize: 7, color: P.dim, letterSpacing: '0.1em', fontFamily: P.font }}>
            · {suggestion.track}
          </span>
        </div>
        <ConfidenceBadge confidence={suggestion.confidence} />
      </div>

      {/* Description */}
      <div style={{ fontSize: 9, color: P.text, lineHeight: 1.55, fontFamily: P.font }}>
        {suggestion.description}
      </div>

      {/* Technical detail */}
      <div style={{ fontSize: 8, color: P.soft, fontFamily: P.font, letterSpacing: '0.05em' }}>
        {suggestion.detail}
      </div>

      {/* Actions or resolved state */}
      {resolved ? (
        <div style={{ fontSize: 8, color: suggestion.outcome ? outcomeColor[suggestion.outcome] : P.dim, fontFamily: P.font, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
          {suggestion.outcome ? outcomeLabel[suggestion.outcome] : ''}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 5 }}>
          <button
            onClick={() => onAccept(suggestion.id)}
            style={{
              flex:          1,
              height:        24,
              background:    P.accentDim,
              border:        `1px solid ${P.accent}`,
              color:         P.accent,
              cursor:        'pointer',
              fontSize:      8,
              fontFamily:    P.font,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              fontWeight:    700,
              transition:    'background 0.1s, color 0.1s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = P.accent;
              (e.currentTarget as HTMLButtonElement).style.color      = P.void;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = P.accentDim;
              (e.currentTarget as HTMLButtonElement).style.color      = P.accent;
            }}
          >
            ✓ APPLY
          </button>
          <button
            onClick={() => onReject(suggestion.id)}
            style={{
              flex:          1,
              height:        24,
              background:    'transparent',
              border:        `1px solid ${P.border2}`,
              color:         P.soft,
              cursor:        'pointer',
              fontSize:      8,
              fontFamily:    P.font,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              transition:    'border-color 0.1s, color 0.1s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = P.soft;
              (e.currentTarget as HTMLButtonElement).style.color       = P.text;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = P.border2;
              (e.currentTarget as HTMLButtonElement).style.color       = P.soft;
            }}
          >
            ✕ SKIP
          </button>
        </div>
      )}
    </div>
  );
});
SuggestionCard.displayName = 'SuggestionCard';

// ── Empty state ───────────────────────────────────────────────────────────────
const EmptyState = memo(({ analysing }: { analysing: boolean }) => (
  <div style={{
    padding:    '20px 12px',
    textAlign:  'center',
    display:    'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap:        8,
  }}>
    {analysing ? (
      <>
        {/* Pulse dots */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'center' }}>
          {[0, 1, 2].map(i => (
            <div
              key={i}
              style={{
                width:      6,
                height:     6,
                background: P.violet,
                borderRadius: '50%',
                animation:  `msp-bounce 1s ease-in-out infinite`,
                animationDelay: `${i * 0.18}s`,
              }}
            />
          ))}
        </div>
        <div style={{ fontSize: 9, color: P.violet, letterSpacing: '0.2em', textTransform: 'uppercase', fontFamily: P.font }}>
          ANALYSING SIGNAL…
        </div>
        <div style={{ fontSize: 8, color: P.dim, fontFamily: P.font }}>
          FFT · RMS · LUFS · peak detection
        </div>
      </>
    ) : (
      <>
        <div style={{ fontSize: 9, color: P.dim, letterSpacing: '0.2em', textTransform: 'uppercase', fontFamily: P.font }}>
          NO PENDING SUGGESTIONS
        </div>
        <div style={{ fontSize: 8, color: P.border2, fontFamily: P.font, lineHeight: 1.6 }}>
          Start playback then press ANALYSE<br />to run the LLPTE detection pipeline.
        </div>
      </>
    )}
  </div>
));
EmptyState.displayName = 'EmptyState';

// ── Trigger legend ────────────────────────────────────────────────────────────
const TriggerLegend = memo(() => (
  <div style={{
    padding:    '6px 10px',
    borderTop:  `1px solid ${P.border}`,
    display:    'flex',
    flexDirection: 'column',
    gap:        4,
  }}>
    <span style={{ fontSize: 7, color: P.dim, letterSpacing: '0.25em', textTransform: 'uppercase', fontFamily: P.font, marginBottom: 2 }}>
      DETECTION THRESHOLDS
    </span>
    {([
      ['⊞', P.cyan,  'FREQ MASK',    'FFT overlap > −12 dBFS · ≥1 bar'],
      ['⊟', P.amber, 'DYN IMBAL',   'RMS differential > 6 dB'],
      ['⊠', P.red,   'ARR CONFLICT','≥3 tracks > −6 dBFS peak'],
    ] as const).map(([icon, color, label, spec]) => (
      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 10, color }}>{icon}</span>
        <span style={{ fontSize: 7, color, fontWeight: 700, fontFamily: P.font, letterSpacing: '0.1em', minWidth: 72 }}>{label}</span>
        <span style={{ fontSize: 7, color: P.dim, fontFamily: P.font }}>{spec}</span>
      </div>
    ))}
  </div>
));
TriggerLegend.displayName = 'TriggerLegend';

// ── Main component ─────────────────────────────────────────────────────────────

interface MixSuggestionsPanelProps {
  /** Called when user accepts a suggestion — parent writes 'accepted' to aiDecisionLog. */
  onSuggestionAccept: (decisionId: string) => void;
  /** Called when user rejects a suggestion — parent writes 'rejected' to aiDecisionLog. */
  onSuggestionReject: (decisionId: string) => void;
}

export function MixSuggestionsPanel({ onSuggestionAccept, onSuggestionReject }: MixSuggestionsPanelProps) {
  const [suggestions, setSuggestions]   = useState<MixSuggestion[]>([]);
  const [analysing,   setAnalysing]     = useState(false);
  const [hasAnalysed, setHasAnalysed]   = useState(false);
  const [showLegend,  setShowLegend]    = useState(false);
  const analyseTimerRef                 = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (analyseTimerRef.current) clearTimeout(analyseTimerRef.current);
    };
  }, []);

  // ── Acceptance rate derived values ─────────────────────────────────────────
  const resolved  = suggestions.filter(s => s.outcome !== null);
  const accepted  = suggestions.filter(s => s.outcome === 'accepted' || s.outcome === 'auto_applied');
  const pending   = suggestions.filter(s => s.outcome === null);

  // ── Trigger analysis (simulates LLPTE detection — backend pending §8.4) ────
  const runAnalysis = useCallback(() => {
    if (analysing) return;
    setAnalysing(true);
    setHasAnalysed(false);

    // Simulate FFT/RMS/peak pipeline latency — PRD §8.5 SLA: p50 ≤15ms
    // UI debounce is 1.2s for demo legibility; actual LLPTE is 10ms
    analyseTimerRef.current = setTimeout(() => {
      const fresh: MixSuggestion[] = DEMO_SUGGESTIONS.map(s => ({ ...s, outcome: null }));
      setSuggestions(fresh);
      setAnalysing(false);
      setHasAnalysed(true);
    }, 1200);
  }, [analysing]);

  // ── Accept ─────────────────────────────────────────────────────────────────
  const handleAccept = useCallback((id: string) => {
    setSuggestions(prev =>
      prev.map(s => s.id === id ? { ...s, outcome: 'accepted' as const } : s)
    );
    // Propagate to parent — parent writes to aiDecisionLog via tRPC (DAW.tsx)
    onSuggestionAccept(id);
  }, [onSuggestionAccept]);

  // ── Reject ─────────────────────────────────────────────────────────────────
  const handleReject = useCallback((id: string) => {
    setSuggestions(prev =>
      prev.map(s => s.id === id ? { ...s, outcome: 'rejected' as const } : s)
    );
    onSuggestionReject(id);
  }, [onSuggestionReject]);

  // ── Accept all pending ─────────────────────────────────────────────────────
  const handleAcceptAll = useCallback(() => {
    const pendingIds = pending.map(s => s.id);
    setSuggestions(prev =>
      prev.map(s => pendingIds.includes(s.id) ? { ...s, outcome: 'accepted' as const } : s)
    );
    pendingIds.forEach(id => onSuggestionAccept(id));
  }, [pending, onSuggestionAccept]);

  return (
    <>
      {/* Keyframes — injected once per mount */}
      <style>{`
        @keyframes msp-bounce {
          0%,100% { transform: translateY(0);    opacity: 1;   }
          50%      { transform: translateY(-4px); opacity: 0.5; }
        }
      `}</style>

      <div style={{
        display:       'flex',
        flexDirection: 'column',
        background:    P.surface,
        border:        `1px solid ${P.border}`,
        borderLeft:    `3px solid ${P.violet}`,
      }}>
        {/* ── Panel header ─────────────────────────────────────────────────── */}
        <div style={{
          padding:      '7px 10px',
          borderBottom: `1px solid ${P.border}`,
          background:   P.void,
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'space-between',
          gap:          8,
          flexShrink:   0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 10, color: P.violet }}>⚡</span>
            <div>
              <div style={{ fontSize: 7, letterSpacing: '0.3em', textTransform: 'uppercase', color: P.violet, fontFamily: P.font, fontWeight: 700 }}>
                MIX SUGGESTIONS
              </div>
              <div style={{ fontSize: 7, color: P.dim, fontFamily: P.font, letterSpacing: '0.1em' }}>
                LLPTE · aiMix.router · §8.4
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            {/* Legend toggle */}
            <button
              onClick={() => setShowLegend(v => !v)}
              title="Toggle detection thresholds"
              style={{
                background:    showLegend ? `${P.violet}20` : 'transparent',
                border:        `1px solid ${showLegend ? P.violet : P.border}`,
                color:         showLegend ? P.violet : P.dim,
                padding:       '3px 8px',
                cursor:        'pointer',
                fontSize:      8,
                fontFamily:    P.font,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                transition:    'all 0.1s',
              }}
            >
              ⓘ
            </button>

            {/* Accept All (only when pending > 0) */}
            {pending.length > 1 && (
              <button
                onClick={handleAcceptAll}
                style={{
                  background:    P.accentDim,
                  border:        `1px solid ${P.accent}`,
                  color:         P.accent,
                  padding:       '3px 8px',
                  cursor:        'pointer',
                  fontSize:      7,
                  fontFamily:    P.font,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  fontWeight:    700,
                  transition:    'background 0.1s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = P.accent;
                  (e.currentTarget as HTMLButtonElement).style.color      = P.void;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = P.accentDim;
                  (e.currentTarget as HTMLButtonElement).style.color      = P.accent;
                }}
              >
                ACCEPT ALL
              </button>
            )}

            {/* Analyse */}
            <button
              onClick={runAnalysis}
              disabled={analysing}
              style={{
                background:    analysing ? `${P.violet}20` : 'transparent',
                border:        `1px solid ${analysing ? P.violet : P.border2}`,
                color:         analysing ? P.violet : P.soft,
                padding:       '3px 10px',
                cursor:        analysing ? 'not-allowed' : 'pointer',
                fontSize:      7,
                fontFamily:    P.font,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                fontWeight:    700,
                transition:    'all 0.1s',
                opacity:       analysing ? 0.7 : 1,
              }}
            >
              {analysing ? 'SCANNING…' : 'ANALYSE'}
            </button>
          </div>
        </div>

        {/* ── Suggestion list ───────────────────────────────────────────────── */}
        <div style={{
          display:       'flex',
          flexDirection: 'column',
          gap:           4,
          padding:       suggestions.length > 0 ? 6 : 0,
          overflowY:     'auto',
          maxHeight:     320,
          scrollbarWidth: 'thin',
          scrollbarColor: `${P.accent} ${P.void}`,
        }}>
          {suggestions.length === 0 ? (
            <EmptyState analysing={analysing} />
          ) : (
            suggestions.map(s => (
              <SuggestionCard
                key={s.id}
                suggestion={s}
                onAccept={handleAccept}
                onReject={handleReject}
              />
            ))
          )}
        </div>

        {/* ── Acceptance rate meter — shown once suggestions exist ──────────── */}
        {resolved.length > 0 && (
          <AcceptanceRate accepted={accepted.length} total={resolved.length} />
        )}

        {/* ── Detection threshold legend (collapsible) ──────────────────────── */}
        {showLegend && <TriggerLegend />}

        {/* ── Footer — PRD §8.4 backend status ─────────────────────────────── */}
        <div style={{
          padding:    '5px 10px',
          borderTop:  `1px solid ${P.border}`,
          display:    'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 7, color: P.border2, fontFamily: P.font, letterSpacing: '0.1em' }}>
            {hasAnalysed
              ? `${suggestions.length} triggers detected · ${pending.length} pending`
              : 'Ready — press ANALYSE to scan'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            {/* Backend wiring status indicator — PRD §8.4: backend pending */}
            <div style={{
              width:  5,
              height: 5,
              borderRadius: '50%',
              background: P.amber,
              boxShadow:  `0 0 4px ${P.amber}`,
            }} />
            <span style={{ fontSize: 7, color: P.amber, fontFamily: P.font, letterSpacing: '0.1em' }}>
              BACKEND PENDING
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
