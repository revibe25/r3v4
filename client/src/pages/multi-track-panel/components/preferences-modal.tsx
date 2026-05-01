/**
 * pages/multi-track-panel/components/preferences-modal.tsx
 * Settings overlay for MultiTrackPanel.
 * Props: preferences, onUpdate, onClose.
 */
import type { CSSProperties } from 'react';
import type { Preferences, ViewMode } from '../types';

interface Props {
  preferences: Preferences;
  onUpdate:    (updates: Partial<Preferences>) => void;
  onClose:     () => void;
}

const _AG = {
  black:  '#060606',
  panel:  '#0d0d0d',
  border: '#1c1c1c',
  acid:   '#a3e635',
  soft:   '#888',
  white:  '#f0f0f0',
};

const row: CSSProperties = {
  display: 'flex', justifyContent: 'space-between',
  alignItems: 'center', padding: '6px 0',
  borderBottom: `1px solid ${AG.border}`,
};

const label: CSSProperties = {
  fontSize: 10, letterSpacing: '.15em',
  textTransform: 'uppercase', color: AG.soft,
  fontFamily: 'IBM Plex Mono, monospace',
};

const select: CSSProperties = {
  background: AG.black, border: `1px solid ${AG.border}`,
  color: AG.white, fontSize: 10, padding: '2px 6px',
  fontFamily: 'IBM Plex Mono, monospace', borderRadius: 0,
};

export function PreferencesModal({ preferences, onUpdate, onClose }: Props) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.75)',
    }}>
      <div style={{
        background: AG.panel, border: `1px solid ${AG.border}`,
        width: 320, boxShadow: '0 16px 48px rgba(0,0,0,0.9)',
        fontFamily: 'IBM Plex Mono, monospace',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', borderBottom: `1px solid ${AG.border}`,
          background: `linear-gradient(90deg, rgba(163,230,53,.04), transparent)`,
        }}>
          <span style={{ fontSize: 10, letterSpacing: '.3em', textTransform: 'uppercase', color: AG.acid }}>
            Preferences
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: AG.soft, cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '8px 16px' }}>
          <div style={row}>
            <span style={label}>Sample Rate</span>
            <select style={select} value={preferences.sampleRate}
              onChange={e => onUpdate({ sampleRate: Number(e.target.value) })}>
              {[44100, 48000, 96000].map(r => <option key={r} value={r}>{r / 1000}kHz</option>)}
            </select>
          </div>
          <div style={row}>
            <span style={label}>Buffer Size</span>
            <select style={select} value={preferences.bufferSize}
              onChange={e => onUpdate({ bufferSize: Number(e.target.value) })}>
              {[128, 256, 512, 1024, 2048].map(b => <option key={b} value={b}>{b} smp</option>)}
            </select>
          </div>
          <div style={row}>
            <span style={label}>View Mode</span>
            <select style={select} value={preferences.viewMode}
              onChange={e => onUpdate({ viewMode: e.target.value as ViewMode })}>
              {(['mixer', 'timeline', 'split'] as const).map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div style={row}>
            <span style={label}>Time Format</span>
            <select style={select} value={preferences.timeFormat}
              onChange={e => onUpdate({ timeFormat: e.target.value })}>
              {['bars', 'time', 'frames'].map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div style={{ ...row, borderBottom: 'none' }}>
            <span style={label}>CPU Meter</span>
            <input type="checkbox" checked={preferences.showCpuMeter}
              onChange={e => onUpdate({ showCpuMeter: e.target.checked })}
              style={{ accentColor: AG.acid, width: 14, height: 14 }} />
          </div>
          <div style={{ ...row, borderBottom: 'none' }}>
            <span style={label}>Auto Save</span>
            <input type="checkbox" checked={preferences.autoSave}
              onChange={e => onUpdate({ autoSave: e.target.checked })}
              style={{ accentColor: AG.acid, width: 14, height: 14 }} />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 16px', borderTop: `1px solid ${AG.border}`, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: `1px solid ${AG.border}`,
              color: AG.soft, cursor: 'pointer', padding: '4px 14px',
              fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase',
              fontFamily: 'IBM Plex Mono, monospace',
            }}
            onMouseEnter={e => {
              (e.target as HTMLButtonElement).style.borderColor = AG.acid;
              (e.target as HTMLButtonElement).style.color = AG.acid;
            }}
            onMouseLeave={e => {
              (e.target as HTMLButtonElement).style.borderColor = AG.border;
              (e.target as HTMLButtonElement).style.color = AG.soft;
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
