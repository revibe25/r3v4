import { Link, useLocation } from 'wouter';
import { Music, LayoutGrid, Plug, Repeat2 } from 'lucide-react';

const S = {
  bg:     '#0c0c0c',
  border: '#222',
  accent: '#b8ff00',
  dim:    '#555',
  font:   "'IBM Plex Mono', 'JetBrains Mono', monospace",
};

const pages = [
  { href: '/',            label: 'Instrument', icon: Music      },
  { href: '/multitrack',  label: 'DAW',        icon: LayoutGrid },
  { href: '/vst',         label: 'VST',        icon: Plug       },
  { href: '/loopstation', label: 'Loop',       icon: Repeat2    },
];

export function PageNav() {
  const [location] = useLocation();
  return (
    <div
      className="flex items-center gap-0 px-3 py-2 border-b flex-shrink-0"
      style={{ background: S.bg, borderColor: S.border, fontFamily: S.font }}
    >
      {pages.map(({ href, label, icon: Icon }) => {
        const active = location === href;
        return (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-1.5 h-7 px-3 text-[10px] uppercase transition-colors"
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
  );
}
