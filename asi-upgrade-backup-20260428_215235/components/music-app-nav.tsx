import { Link, useLocation } from "wouter";
import { MUSIC_NAV_LINKS } from "@/config/music-nav-links";

export function MusicAppNav() {
  const [pathname] = useLocation();
  return (
    <nav className="ag-controls-block" aria-label="Music sections">
      {MUSIC_NAV_LINKS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={
            "ag-nav-btn" + (pathname.startsWith(href) ? " ag-nav-active" : "")
          }
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}