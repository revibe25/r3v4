// client/src/components/page-nav.tsx
import { Link, useLocation } from 'wouter';
import { Tag, LogIn, Music, LayoutGrid, Plug, Repeat2, Settings } from 'lucide-react';

const S = {
  bg:     '#0c0c0c',
  border: '#222',
  accent: '#b8ff00',
  dim:    '#555',
  font:   "'IBM Plex Mono', 'JetBrains Mono', monospace",
} as const;

const PAGES = [
  { href: '/',            label: 'Pricing',    icon: Tag        },
  { href: '/login',       label: 'Login',      icon: LogIn      },
  { href: '/instrument',  label: 'Instrument', icon: Music      },
  { href: '/multitrack',  label: 'DAW',        icon: LayoutGrid },
  { href: '/vst',         label: 'VST',        icon: Plug       },
  { href: '/loopstation', label: 'Loop',       icon: Repeat2    },
] as const;

export function PageNav() {
  const [location] = useLocation();

  return (
    <nav
      className="flex items-center gap-0 px-3 py-2 border-b flex-shrink-0"
      style={{ background: S.bg, borderColor: S.border, fontFamily: S.font }}
      aria-label="Main navigation"
    >
      {/* ── Page buttons (left) ── */}
      <div className="flex items-center flex-1" style={{ gap: 0 }}>
        {PAGES.map(({ href, label, icon: Icon }) => {
          const active = location === href;
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-1.5 h-7 px-3 text-[10px] uppercase transition-colors"
              aria-current={active ? 'page' : undefined}
              style={{
                background:     active ? S.accent : 'transparent',
                color:          active ? '#000'   : S.dim,
                border:         `1px solid ${active ? S.accent : S.border}`,
                borderRadius:   0,
                letterSpacing:  1,
                marginRight:    2,
                textDecoration: 'none',
              }}
            >
              <Icon size={11} />
              {label}
            </Link>
          );
        })}
      </div>

      {/* ── Settings icon (right) ── */}
      {/* TODO: wire onClick to settings panel once spec is provided */}
      <button
        className="flex items-center justify-center h-7 w-7 transition-colors"
        style={{
          background:   'transparent',
          color:        S.dim,
          border:       `1px solid ${S.border}`,
          borderRadius: 0,
          marginLeft:   6,
          cursor:       'pointer',
          flexShrink:   0,
        }}
        aria-label="Settings"
        onMouseEnter={e => {
          e.currentTarget.style.background   = S.accent;
          e.currentTarget.style.color        = '#000';
          e.currentTarget.style.borderColor  = S.accent;
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background   = 'transparent';
          e.currentTarget.style.color        = S.dim;
          e.currentTarget.style.borderColor  = S.border;
        }}
        onClick={() => {
          // intentional no-op until settings panel spec is confirmed
        }}
      >
        <Settings size={11} />
      </button>
    </nav>
  );
}
