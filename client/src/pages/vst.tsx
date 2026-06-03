/**
 * client/src/pages/vst.tsx
 * VST Plugin Browser & FX Chain Manager — R3 v4
 *
 * PRD §10 Note: VST/AU/AAX native plugin support is a confirmed Non-Goal
 * for MVP — "Requires native binary bridge — months of work — Post-Series A".
 * This page hosts VSTBrowser for the in-browser FX chain (Web Audio FX nodes)
 * and clearly communicates the native plugin roadmap status.
 *
 * Design: Acid-techno palette per SKILLS.md §7 canonical inline-style pattern.
 * No Tailwind — all inline styles from palette constants.
 * ASI v2: no `any`, no @ts-nocheck, no swallowed exceptions.
 *
 * Route: /vst  (ProtectedRoute — requires auth)
 */

import { useState } from 'react';
import { VSTBrowser } from '@/components/vst-browser';
import type { VSTPluginInfo } from '@/audio/fx/vst-scanner';

// ── Canonical palette — SKILLS.md §7 ────────────────────────────────────────
const T = {
  bg:        '#0a0a0a',
  surface:   '#0d0d0d',
  border:    '#1c1c1c',
  text:      '#e5e5e5',
  dim:       '#555',
  soft:      'var(--text-dim)',
  accent:    '#a3e635',
  cyan:      'var(--accent-cyan)',   // PRD §3 — active state color
  violet:    'var(--accent-purple)',   // PRD §3 — AI color
  amber:     'var(--status-warn)',   // PRD §3 — warning
  font:      '"IBM Plex Mono", "JetBrains Mono", monospace',
} as const;

// ── PRD §10 Non-Goal banner ───────────────────────────────────────────────────

function NonGoalBanner() {
  return (
    <div style={{
      display:      'flex',
      alignItems:   'center',
      gap:          12,
      padding:      '8px 16px',
      background:   'rgba(245,158,11,0.07)',
      border:       `1px solid rgba(245,158,11,0.3)`,
      borderLeft:   `3px solid ${T.amber}`,
      marginBottom: 16,
    }}>
      <span style={{ color: T.amber, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: T.font }}>
        ⚠ PRD §10 — Non-Goal
      </span>
      <span style={{ color: T.soft, fontSize: 9, fontFamily: T.font }}>
        Native VST / AU / AAX plugin bridge requires a native binary — Post-Series A. This page manages the Web Audio FX chain only.
      </span>
      <span style={{
        marginLeft: 'auto',
        padding:    '2px 8px',
        background: 'rgba(245,158,11,0.12)',
        border:     `1px solid rgba(245,158,11,0.25)`,
        color:      T.amber,
        fontSize:   8,
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        fontFamily: T.font,
        whiteSpace: 'nowrap',
      }}>
        Post-Series A
      </span>
    </div>
  );
}

// ── FX node status grid ───────────────────────────────────────────────────────

interface FxNodeEntry {
  id:     string;
  label:  string;
  status: 'active' | 'idle' | 'pending';
  note:   string;
}

const FX_NODES: FxNodeEntry[] = [
  { id: 'reverb',     label: 'Reverb',     status: 'active',  note: 'ConvolverNode + IR presets' },
  { id: 'delay',      label: 'Delay',      status: 'active',  note: 'BiquadFilterNode feedback loop' },
  { id: 'compressor', label: 'Compressor', status: 'active',  note: 'DynamicsCompressorNode' },
  { id: 'eq',         label: 'EQ',         status: 'active',  note: '6-band BiquadFilterNode chain' },
  { id: 'sidechain',  label: 'Sidechain',  status: 'idle',    note: 'GainNode + AnalyserNode duck' },
  { id: 'ms-width',   label: 'M/S Width',  status: 'idle',    note: 'Mid/Side matrix via StereoPanner' },
  { id: 'vst-bridge', label: 'VST Bridge', status: 'pending', note: 'Native binary — Post-Series A' },
];

const STATUS_COLOR: Record<FxNodeEntry['status'], string> = {
  active:  T.accent,
  idle:    'var(--dj-dim)',
  pending: T.amber,
};

const STATUS_LABEL: Record<FxNodeEntry['status'], string> = {
  active:  '● ACTIVE',
  idle:    '○ IDLE',
  pending: '◇ ROADMAP',
};

function FxChainStatusGrid() {
  return (
    <div style={{
      display:             'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
      gap:                 1,
      background:          'rgba(0,0,0,0.4)',
      border:              '1px solid rgba(255,255,255,0.04)',
      borderRadius:        2,
      marginBottom:        24,
    }}>
      {FX_NODES.map(node => (
        <div key={node.id} style={{
          background:  'linear-gradient(135deg,rgba(255,255,255,0.025) 0%,rgba(0,0,0,0) 100%)',
          padding:     '12px 16px',
          borderLeft:  `3px solid ${STATUS_COLOR[node.status]}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: T.text, fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: T.font }}>
              {node.label}
            </span>
            <span style={{ color: STATUS_COLOR[node.status], fontSize: 8, letterSpacing: '0.2em', fontFamily: T.font }}>
              {STATUS_LABEL[node.status]}
            </span>
          </div>
          <div style={{ color: T.dim, fontSize: 9, fontFamily: T.font }}>
            {node.note}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

interface SectionHeaderProps {
  num:    string;
  label:  string;
  tag?:   string;
  tagColor?: string;
}

function SectionHeader({ num, label, tag, tagColor = T.violet }: SectionHeaderProps) {
  return (
    <div style={{
      display:      'flex',
      alignItems:   'center',
      gap:          12,
      padding:      '6px 0',
      marginBottom: 12,
      borderBottom: `1px solid ${T.border}`,
    }}>
      <span style={{ color: T.accent, fontFamily: T.font, fontSize: 8, letterSpacing: '0.3em' }}>
        {num}
      </span>
      <span style={{ color: T.text, fontFamily: T.font, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
        {label}
      </span>
      {tag && (
        <span style={{
          marginLeft:    'auto',
          color:         tagColor,
          fontSize:      8,
          letterSpacing: '0.2em',
          fontFamily:    T.font,
          padding:       '2px 8px',
          border:        `1px solid ${tagColor}44`,
          background:    `${tagColor}10`,
          textTransform: 'uppercase',
        }}>
          {tag}
        </span>
      )}
    </div>
  );
}

// ── LLPTE integration callout ─────────────────────────────────────────────────

function LLPTECallout() {
  return (
    <div style={{
      marginTop:  24,
      padding:    '10px 14px',
      background: 'rgba(124,58,237,0.06)',
      border:     `1px solid rgba(124,58,237,0.25)`,
      borderLeft: `3px solid ${T.violet}`,
      display:    'flex',
      gap:        12,
      alignItems: 'flex-start',
    }}>
      <span style={{ color: T.violet, fontSize: 16, lineHeight: '1' }}>⬡</span>
      <div>
        <div style={{ color: T.violet, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', fontFamily: T.font, marginBottom: 4 }}>
          LLPTE · outputBus Integration
        </div>
        <div style={{ color: T.soft, fontSize: 9, fontFamily: T.font, lineHeight: 1.65 }}>
          All Web Audio FX nodes loaded here feed into the LLPTE{' '}
          <span style={{ color: T.cyan }}>outputBus</span> pipeline node.
          Gain staging, EQ, and sidechain decisions flow from{' '}
          <span style={{ color: T.violet }}>aiMixEngine</span> → FX chain → master output.
          {' '}Confidence gate: ≥0.65 auto-apply · ≥0.40 ghost suggestion · &lt;0.40 discarded to aiDecisionLog.
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function VSTPage() {
  const [selectedPlugin, setSelectedPlugin] = useState<VSTPluginInfo | null>(null);

  const handlePluginSelect = (plugin: VSTPluginInfo): void => {
    setSelectedPlugin(plugin);
  };

  return (
    <>
          <header className="ag-header">
            <div className="ag-header-top">
              <div className="ag-wordmark-block">
                <div className="ag-wordmark" data-testid="text-title">
                  R3<span className="ag-wordmark-slash">/</span>VST
                </div>
                <div className="ag-wordmark-sub">VST · Plugin Browser</div>
              </div>
            </div>
          </header>

    <div style={{
      display:       'flex',
      flexDirection: 'column',
      height:        '100vh',
      background:    T.bg,
      color:         T.text,
      fontFamily:    T.font,
      overflow:      'hidden',
    }}>

      {/* Sub-header strip */}
      <div style={{
        padding:      '7px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        background:   'rgba(8,8,8,0.6)',
        display:      'flex',
        alignItems:   'center',
        gap:          16,
      }}>
        <span style={{ color: T.accent, fontSize: 9, letterSpacing: '0.35em', textTransform: 'uppercase' }}>
          FX
        </span>
        <span style={{ width: 1, height: 14, background: T.border }} />
        <span style={{ color: T.dim, fontSize: 9, letterSpacing: '0.12em' }}>
          Web Audio FX Chain · LLPTE outputBus
        </span>
        {selectedPlugin !== null && (
          <>
            <span style={{ width: 1, height: 14, background: T.border, marginLeft: 'auto' }} />
            <span style={{ color: T.cyan, fontSize: 9, letterSpacing: '0.12em' }}>
              ● {selectedPlugin.name}
            </span>
          </>
        )}
      </div>


      {/* Ticker */}
      <style>{`@keyframes ag-scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
      <div style={{ overflow:'hidden', position:'relative', background:'#080808', padding:'5px 0', flexShrink:0 }}>
        <div style={{ display:'flex', width:'max-content', animation:'ag-scroll 28s linear infinite' }}>
          {['R3 Native','Web Audio API','Offline-First','MIDI Support','Polyphony','Accessible','MultiTrack DAW','VST System','R3 Native','Web Audio API','Offline-First','MIDI Support','Polyphony','Accessible','MultiTrack DAW','VST System'].map((item, i) => (
            <span key={i} style={{ padding:'0 18px', fontSize:9, letterSpacing:'0.2em', textTransform:'uppercase', fontFamily:'"IBM Plex Mono",monospace', color:'#fff', whiteSpace:'nowrap' }}>
              {item}<span style={{ color:'#a3e635', marginLeft:8 }}>/</span>
            </span>
          ))}
        </div>
      </div>
      {/* Scrollable body */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>

        <NonGoalBanner />

        <SectionHeader num="01 —" label="FX Chain Status" tag="LLPTE WIRED" />
        <FxChainStatusGrid />

        <div style={{ border: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0)', borderRadius: 2 }}>
          <VSTBrowser
            onPluginSelect={handlePluginSelect}
            channelId="master"
            showFXChain={true}
          />
        </div>

        <LLPTECallout />

        {/* Footer metadata row */}
        <div style={{
          marginTop:  24,
          paddingTop: 12,
          borderTop:  `1px solid ${T.border}`,
          display:    'flex',
          gap:        24,
          flexWrap:   'wrap',
        }}>
          {([
            ['Engine',      'Web Audio API · AudioWorklet'],
            ['Pipeline',    'LLPTE outputBus → spectralAnalyzer'],
            ['Latency SLA', '≤10ms round-trip'],
            ['VST Bridge',  'Post-Series A · PRD §10'],
            ['Build',       'R3 v4.1 · TSC 0 errors'],
          ] as const).map(([k, v]) => (
            <div key={k}>
              <div style={{ color: T.dim, fontSize: 8, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 3, fontFamily: T.font }}>
                {k}
              </div>
              <div style={{ color: T.soft, fontSize: 9, fontFamily: T.font }}>
                {v}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </>
  );
}