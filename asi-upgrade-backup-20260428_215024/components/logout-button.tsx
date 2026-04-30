// client/src/components/logout-button.tsx
// Canonical logout — used by PageNav (full) and HeaderControls (compact).
// Confirmation popover prevents accidental sign-out.
// Clears Zustand store + localStorage, then navigates to /login via wouter.

import { useState, useCallback, useRef, useEffect } from 'react';
import { useLocation } from 'wouter';
import { LogOut } from 'lucide-react';
import { useAuthStore } from '@/hooks/authStore';

const S = {
  bg:     '#0c0c0c',
  border: '#222',
  accent: '#a3e635',
  dim:    '#555',
  danger: '#ff3b3b',
  font:   "'IBM Plex Mono', 'JetBrains Mono', monospace",
} as const;

interface LogoutButtonProps {
  variant?: 'compact' | 'full';
}

export function LogoutButton({ variant = 'full' }: LogoutButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [, navigate]  = useLocation();
  const { logout } = useAuthStore();
  const popoverRef    = useRef<HTMLDivElement>(null);
  const triggerRef    = useRef<HTMLButtonElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!confirming) return;
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) setConfirming(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [confirming]);

  // Close on Escape
  useEffect(() => {
    if (!confirming) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfirming(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [confirming]);

  const handleConfirm = useCallback(() => {
    logout();                          // clears hooks/authStore + r3_token
    localStorage.removeItem('r3-auth'); // purge legacy stores/authStore key
    setConfirming(false);
    navigate('/login');
  }, [logout, navigate]);

  return (
    <div style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      <button
        ref={triggerRef}
        onClick={() => setConfirming(v => !v)}
        aria-label="Sign out"
        aria-expanded={confirming}
        style={{
          display:       'flex',
          alignItems:    'center',
          gap:           6,
          height:        28,
          padding:       variant === 'full' ? '0 12px' : '0 8px',
          background:    confirming ? 'rgba(255,59,59,0.12)' : 'transparent',
          color:         confirming ? S.danger : S.dim,
          border:        `1px solid ${confirming ? S.danger : S.border}`,
          borderRadius:  0,
          cursor:        'pointer',
          fontFamily:    S.font,
          fontSize:      10,
          letterSpacing: 1,
          textTransform: 'uppercase' as const,
          flexShrink:    0,
          transition:    'all .15s',
        }}
        onMouseEnter={e => {
          if (confirming) return;
          e.currentTarget.style.background  = 'rgba(255,59,59,0.08)';
          e.currentTarget.style.color       = S.danger;
          e.currentTarget.style.borderColor = S.danger;
        }}
        onMouseLeave={e => {
          if (confirming) return;
          e.currentTarget.style.background  = 'transparent';
          e.currentTarget.style.color       = S.dim;
          e.currentTarget.style.borderColor = S.border;
        }}
      >
        <LogOut size={11} />
        {variant === 'full' && <span>Sign Out</span>}
      </button>

      {confirming && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Confirm sign out"
          style={{
            position:   'absolute',
            top:        'calc(100% + 6px)',
            right:      0,
            zIndex:     9999,
            background: S.bg,
            border:     `1px solid ${S.danger}`,
            borderTop:  `2px solid ${S.danger}`,
            padding:    '12px 14px',
            minWidth:   '176px',
            fontFamily: S.font,
            boxShadow:  '0 8px 32px rgba(0,0,0,0.7)',
          }}
        >
          <p style={{
            fontSize:      9,
            letterSpacing: '.15em',
            textTransform: 'uppercase',
            color:         'rgba(255,255,255,0.35)',
            marginBottom:  10,
            lineHeight:    1.6,
            margin:        '0 0 10px 0',
          }}>
            End session?
          </p>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={handleConfirm}
              autoFocus
              style={{
                flex:          1,
                padding:       '7px 0',
                background:    S.danger,
                color:         '#fff',
                border:        'none',
                borderRadius:  0,
                cursor:        'pointer',
                fontFamily:    S.font,
                fontSize:      9,
                letterSpacing: '.15em',
                textTransform: 'uppercase' as const,
                fontWeight:    700,
                transition:    'background .1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#cc2020'; }}
              onMouseLeave={e => { e.currentTarget.style.background = S.danger; }}
            >
              Sign Out
            </button>
            <button
              onClick={() => setConfirming(false)}
              style={{
                flex:          1,
                padding:       '7px 0',
                background:    'transparent',
                color:         S.dim,
                border:        `1px solid ${S.border}`,
                borderRadius:  0,
                cursor:        'pointer',
                fontFamily:    S.font,
                fontSize:      9,
                letterSpacing: '.15em',
                textTransform: 'uppercase' as const,
                transition:    'all .1s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background  = '#1a1a1a';
                e.currentTarget.style.borderColor = '#444';
                e.currentTarget.style.color       = '#888';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background  = 'transparent';
                e.currentTarget.style.borderColor = S.border;
                e.currentTarget.style.color       = S.dim;
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
