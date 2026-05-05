/**
 * pages/multi-track-panel/components/vst-panel-modal.tsx
 * VST plugin panel for a specific track.
 * Props: trackId, trackName, onClose.
 */
import { Link } from 'wouter';

interface Props {
  trackId:   string;
  trackName?: string;
  onClose:   () => void;
}

const AG = {
  panel:  '#0d0d0d',
  border: '#1c1c1c',
  acid:   '#a3e635',
  soft:   'var(--text-dim)',
  dim:    'var(--neutral-700)',
  white:  'var(--daw-fg)',
};

export function VSTPanelModal({ trackId, trackName, onClose }: Props) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.75)',
    }}>
      <div style={{
        background: AG.panel, border: `1px solid ${AG.border}`,
        width: 400, boxShadow: '0 16px 48px rgba(0,0,0,0.9)',
        fontFamily: 'IBM Plex Mono, monospace',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', borderBottom: `1px solid ${AG.border}`,
          background: `linear-gradient(90deg, rgba(163,230,53,.04), transparent)`,
        }}>
          <span style={{ fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', color: AG.acid }}>
            VST — {trackName ?? trackId}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: AG.soft, cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '32px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>⚡</div>
          <p style={{ fontSize: 11, color: AG.soft, lineHeight: 1.7, margin: 0 }}>
            VST plugin management for<br />
            <span style={{ color: AG.acid }}>{trackName ?? trackId}</span>
          </p>
          <p style={{ fontSize: 10, color: AG.dim, marginTop: 12 }}>
            Visit{' '}
            <Link href="/vst" style={{ color: AG.acid, textDecoration: 'none' }}>/vst</Link>
            {' '}to load and configure plugins.
          </p>
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
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
