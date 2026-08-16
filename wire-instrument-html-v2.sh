#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# ASI Solid Instrument Wiring Script (v2 Hardened)
# Target: client/src/pages/instrument.tsx
# ==============================================================================

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info()  { echo -e "${CYAN}[INFO]${NC} $1"; }
log_succ()  { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_err()   { echo -e "${RED}[ERROR]${NC} $1"; }

# 1. Resolve Root Directory
PROJECT_ROOT="${HOME}/Stable"
if [[ ! -d "$PROJECT_ROOT" ]]; then
    if [[ -d "./client" ]]; then
        PROJECT_ROOT="$(pwd)"
    else
        log_err "Could not locate project root at ${PROJECT_ROOT} or current directory."
        exit 1
    fi
fi

cd "$PROJECT_ROOT"
log_info "Project Root: ${PROJECT_ROOT}"

# 2. Locate Specific Instrument HTML Asset
HTML_ASSET=""
PREFERRED_ASSET="client/public/attached_assets/instrument2.1.1_1765509600054.html"

if [[ $# -ge 1 && -f "$1" ]]; then
    HTML_ASSET="$1"
elif [[ -f "$PREFERRED_ASSET" ]]; then
    HTML_ASSET="$PREFERRED_ASSET"
else
    HTML_ASSET=$(find client/public/attached_assets public/attached_assets -type f -name "instrument*.html" 2>/dev/null | head -n 1 || true)
fi

if [[ -z "$HTML_ASSET" ]]; then
    log_err "No instrument HTML file found in attached_assets."
    exit 1
fi

log_info "Selected HTML Asset: ${HTML_ASSET}"

# Convert client/public/ attached asset path to Vite web relative URL
PUBLIC_URL_PATH=$(echo "$HTML_ASSET" | sed -E 's|^.*public/|/|')
log_info "Web Relative Path: ${PUBLIC_URL_PATH}"

# 3. Pathing & Atomic Backup
TARGET_DIR="client/src/pages"
TARGET_FILE="${TARGET_DIR}/instrument.tsx"
BACKUP_DIR="archive/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

mkdir -p "$TARGET_DIR"
mkdir -p "$BACKUP_DIR"

if [[ -f "$TARGET_FILE" ]]; then
    BACKUP_FILE="${BACKUP_DIR}/instrument.tsx.bak_${TIMESTAMP}"
    cp "$TARGET_FILE" "$BACKUP_FILE"
    log_warn "Existing file backed up to: ${BACKUP_FILE}"
fi

# 4. Generate Code using Quoted Heredoc (Prevents TSX Syntax Corruption)
TEMP_FILE=$(mktemp)

cat << 'EOF' > "$TEMP_FILE"
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Maximize2, Minimize2, RefreshCw, Volume2 } from 'lucide-react';

/**
 * Integrated ASI HTML Instrument Module Page
 * Asset Path: __PUBLIC_URL_PATH__
 */
export default function InstrumentPage() {
  const [loading, setLoading] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleReload = () => {
    setLoading(true);
    if (iframeRef.current) {
      iframeRef.current.src = `__PUBLIC_URL_PATH__?t=${Date.now()}`;
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch((err) => {
        console.error(`Fullscreen failed: ${err.message}`);
      });
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  useEffect(() => {
    const handleFSChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFSChange);
    return () => document.removeEventListener('fullscreenchange', handleFSChange);
  }, []);

  return (
    <div 
      ref={containerRef}
      className="relative flex flex-col w-full h-full min-h-[600px] bg-background text-foreground overflow-hidden rounded-lg border border-border/40 shadow-2xl"
    >
      {/* Control Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/20 border-b border-border/40 backdrop-blur-md select-none shrink-0">
        <div className="flex items-center space-x-2">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <Volume2 className="h-4 w-4 text-emerald-400" />
          <h1 className="text-xs font-mono font-semibold tracking-wider uppercase text-muted-foreground">
            HTML Instrument Workstation
          </h1>
        </div>

        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleReload}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title="Reload Workstation"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* Embedded Audio Viewport */}
      <div className="relative flex-1 w-full h-full bg-black/90 overflow-hidden">
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm">
            <Loader2 className="h-7 w-7 animate-spin text-primary mb-3" />
            <p className="text-xs text-muted-foreground font-mono tracking-widest uppercase">
              Initializing WebAudio DSP Engine...
            </p>
          </div>
        )}

        <iframe
          ref={iframeRef}
          src="__PUBLIC_URL_PATH__"
          className="w-full h-full border-0 outline-none block"
          onLoad={() => setLoading(false)}
          allow="autoplay; audio; microphone; midi; display-capture"
          sandbox="allow-scripts allow-same-origin allow-modals allow-downloads allow-forms"
          title="Audio Workstation Module"
        />
      </div>
    </div>
  );
}
EOF

# 5. Inject Web Path safely
sed -i "s|__PUBLIC_URL_PATH__|${PUBLIC_URL_PATH}|g" "$TEMP_FILE"

# 6. Apply File
mv "$TEMP_FILE" "$TARGET_FILE"
chmod 644 "$TARGET_FILE"

log_succ "Wired instrument component to ${TARGET_FILE}"
