/**
 * client/src/components/page-nav.tsx
 * R3 v4 — global navigation bar.
 *
 * Design: acid-hardware strip — IBM Plex Mono, lime-green accent (#a3e635),
 * emissive active state, tier badge, per-item auth awareness.
 *
 * Key behaviours
 * ──────────────
 * • Returns null on NAV_HIDDEN_ON routes (e.g. /auth) — keeps auth page clean.
 * • Hides the Login button when the user is already authenticated.
 * • Exposes NAV_HEIGHT_PX as a named export so App.tsx can inject --nav-h.
 * • Active page gets accent background + emissive border; others are dimmed.
 * • Tier badge (FREE / PRO / ELITE) shown next to logout when authenticated.
 * • Admin link only appears for the designated admin email.
 * • Settings button wired for future panel (no-op intentional, documented).
 *
 * Routing: Wouter useLocation() — NOT react-router-dom.
 * Auth   : @/stores/authStore (the stores/ copy used by this component).
 */

import { Link, useLocation } from 'wouter';
import {
  Tag, LogIn, Music, Radio, Repeat2,
  Settings, Shield, Layers, Users, Sliders,
} from 'lucide-react';
import { LogoutButton } from '@/components/logout-button';
import { useAuthStore, selectIsAuthed } from '@/hooks/authStore';

// ── Layout token ─────────────────────────────────────────────────────────────
// Exported so App.tsx can inject `--nav-h` as a CSS custom property.
// Pages needing to fill the remaining viewport should use:
//   height: calc(100vh - var(--nav-h))
export const NAV_HEIGHT_PX = 44;

// ── Routes where nav is suppressed entirely ───────────────────────────────────
const NAV_HIDDEN_ON: string[] = ['/auth', '/login', '/instrument', '/daw'];

// ── Admin gate ────────────────────────────────────────────────────────────────
const ADMIN_EMAIL = 'earnestathepco@gmail.com';

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  bg:        '#0c0c0c',
  border:    '#222',
  accent:    '#a3e635',
  accentDim: '#a3e63522',
  dim:       '#444',
  dimHover:  '#888',
  font:      "'IBM Plex Mono', 'JetBrains Mono', monospace",
} as const;

// ── Tier badge colours ────────────────────────────────────────────────────────
const TIER_STYLE: Record<string, { color: string; border: string }> = {
  explorer:   { color: '#555',    border: '#333'      },
  creator:    { color: '#f59e0b', border: '#f59e0b44' },
  pro_artist: { color: '#a3e635', border: '#a3e63544' },
};

// ── Page definitions — ordered by intended user journey ──────────────────────
//
//   1. /pricing     — visitor lands here first (App.tsx root redirect)
//   2. /auth        — login / register (hidden when authenticated)
//   3. /instrument  — first tool after login
//   4. /daw         — main production suite
//   5. /loopstation — loop recorder console
//   6. /multitrack  — multitrack DAW (MultiTrackPanel)
//   7. /collab      — collaborative DAW pro (WaveLab)
//   8. /mixer       — drag & drop mixer view (MultitrackView)
//
const PAGES = [
  { href: '/pricing',    label: 'Pricing',    icon: Tag,     authOnly: false, hideWhenAuthed: false },
  { href: '/auth',       label: 'Login',      icon: LogIn,   authOnly: false, hideWhenAuthed: true  },
  { href: '/instrument', label: 'Instrument', icon: Music,   authOnly: true,  hideWhenAuthed: false },
  { href: '/daw',        label: 'Studio',     icon: Radio,   authOnly: true,  hideWhenAuthed: false },
  { href: '/loopstation',label: 'Loop',       icon: Repeat2, authOnly: true,  hideWhenAuthed: false },
  { href: '/multitrack', label: 'Multitrack', icon: Layers,  authOnly: true,  hideWhenAuthed: false },
  { href: '/collab',     label: 'Collab',     icon: Users,   authOnly: true,  hideWhenAuthed: false },
  { href: '/mixer',      label: 'Mixer',      icon: Sliders, authOnly: true,  hideWhenAuthed: false },
] as const;

// ── Component ─────────────────────────────────────────────────────────────────

export function PageNav() {
  const [location] = useLocation();
  const isAuthenticated = useAuthStore(selectIsAuthed);
  const userEmail       = useAuthStore(s => s.user?.email ?? '');
  const tier            = useAuthStore(s => s.user?.tier ?? 'explorer');
  const isAdmin         = userEmail === ADMIN_EMAIL;

  // Suppress nav entirely on auth/login pages — clean UX, no self-referential links
  if (NAV_HIDDEN_ON.includes(location)) return null;

  const tierStyle = TIER_STYLE[tier] ?? TIER_STYLE.explorer;

  return (
    <nav
      aria-label="Main navigation"
      style={{
        display:     'flex',
        alignItems:  'center',
        height:       NAV_HEIGHT_PX,
        padding:     '0 12px',
        background:   T.bg,
        borderBottom: `1px solid ${T.border}`,
        fontFamily:   T.font,
        flexShrink:   0,
        gap:          0,
        userSelect:  'none',
        boxSizing:   'border-box',
      }}
    >
      {/* ── Page buttons (left) ─────────────────────────────────────────── */}
      <div
        style={{
          display:    'flex',
          alignItems: 'center',
          flex:        1,
          gap:         2,
          overflow:   'hidden',
        }}
      >
        {PAGES.map(({ href, label, icon: Icon, authOnly, hideWhenAuthed }) => {
          if (hideWhenAuthed && isAuthenticated) return null;
          if (authOnly && !isAuthenticated) return null;

          const active = location === href;

          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              style={{
                display:        'flex',
                alignItems:     'center',
                gap:             5,
                height:          28,
                padding:        '0 10px',
                background:      active ? T.accentDim : 'transparent',
                color:           active ? T.accent    : T.dim,
                border:         `1px solid ${active ? T.accent : T.border}`,
                borderRadius:    0,
                fontSize:        9,
                letterSpacing:  '0.14em',
                textTransform:  'uppercase',
                textDecoration: 'none',
                whiteSpace:     'nowrap',
                cursor:         'pointer',
                transition:     'color 0.12s, background 0.12s, border-color 0.12s',
                boxShadow:       active ? `0 0 8px ${T.accent}33` : 'none',
              }}
              onMouseEnter={e => {
                if (!active) {
                  const el = e.currentTarget as HTMLAnchorElement;
                  el.style.color       = T.dimHover;
                  el.style.borderColor = '#444';
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  const el = e.currentTarget as HTMLAnchorElement;
                  el.style.color       = T.dim;
                  el.style.borderColor = T.border;
                }
              }}
            >
              <Icon size={10} strokeWidth={1.5} />
              {label}
            </Link>
          );
        })}
      </div>

      {/* ── Right cluster ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>

        {/* Tier badge — only when authenticated */}
        {isAuthenticated && (
          <span
            style={{
              padding:       '2px 7px',
              border:        `1px solid ${tierStyle.border}`,
              color:          tierStyle.color,
              fontSize:       8,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              fontFamily:     T.font,
              lineHeight:     1,
            }}
          >
            {tier}
          </span>
        )}

        {/* Admin link */}
        {isAuthenticated && isAdmin && (
          <a
            href="/admin"
            style={{
              display:       'flex',
              alignItems:    'center',
              gap:            4,
              height:         28,
              padding:       '0 10px',
              background:    'transparent',
              border:        `1px solid ${T.border}`,
              color:          T.dim,
              fontSize:       9,
              letterSpacing: '0.14em',
              textDecoration: 'none',
              fontFamily:     T.font,
              cursor:        'pointer',
              transition:    'color 0.12s, border-color 0.12s',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLAnchorElement;
              el.style.borderColor = T.accent;
              el.style.color       = T.accent;
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLAnchorElement;
              el.style.borderColor = T.border;
              el.style.color       = T.dim;
            }}
          >
            <Shield size={10} strokeWidth={1.5} />
            ADMIN
          </a>
        )}

        {/* Settings — no-op until panel spec is confirmed */}
        <button
          aria-label="Settings (coming soon)"
          title="Settings (coming soon)"
          style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            height:          28,
            width:           28,
            background:     'transparent',
            border:         `1px solid ${T.border}`,
            color:           T.dim,
            cursor:         'pointer',
            padding:         0,
            flexShrink:      0,
            transition:     'color 0.12s, border-color 0.12s, background 0.12s',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.background  = T.accentDim;
            el.style.color       = T.accent;
            el.style.borderColor = T.accent;
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.background  = 'transparent';
            el.style.color       = T.dim;
            el.style.borderColor = T.border;
          }}
          onClick={() => { /* intentional no-op — settings panel TBD */ }}
        >
          <Settings size={11} strokeWidth={1.5} />
        </button>

        {/* Logout */}
        {isAuthenticated && (
          <div style={{ marginLeft: 2 }}>
            <LogoutButton variant="full" />
          </div>
        )}
      </div>
    </nav>
  );
}