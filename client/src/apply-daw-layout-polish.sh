#!/usr/bin/env bash
# DAW Layout Polish - Implementation Script
# Target: ~/Stable/client/src

set -euo pipefail
IFS=$'\n\t'

PROJECT_ROOT="${HOME}/Stable"
SRC_DIR="${PROJECT_ROOT}/client/src"
BACKUP_DIR="${PROJECT_ROOT}/.backups/daw-layout-polish-$(date +%Y%m%d-%H%M%S)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}   $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

check_file_exists() {
    local file="$1"
    if [[ -f "${SRC_DIR}/${file}" ]]; then echo "EXISTS"; else echo "MISSING"; fi
}

check_string_in_file() {
    local file="$1"
    local pattern="$2"
    if grep -q "${pattern}" "${SRC_DIR}/${file}" 2>/dev/null; then echo "FOUND"; else echo "NOT_FOUND"; fi
}

# Phase 0: Pre-flight
log_info "=== PHASE 0: Pre-flight Verification ==="

if [[ ! -d "${SRC_DIR}" ]]; then
    log_error "Source directory not found: ${SRC_DIR}"
    exit 1
fi

log_ok "Project root found: ${PROJECT_ROOT}"

REQUIRED_FILES=("pages/DAW.tsx" "store/index.ts" "components/ui/index.ts")
for file in "${REQUIRED_FILES[@]}"; do
    status=$(check_file_exists "${file}")
    if [[ "${status}" == "MISSING" ]]; then
        log_error "Required file missing: ${file}"
        exit 1
    fi
    log_ok "Found: ${file}"
done

LAYOUT_STORE_EXISTS=$(check_file_exists "store/layout-store.ts")
RESIZE_HANDLE_EXISTS=$(check_file_exists "components/ui/panel-resize-handle.tsx")
LAYOUT_EXPORT_EXISTS=$(check_string_in_file "store/index.ts" "useLayoutStore")
DAW_IMPORT_EXISTS=$(check_string_in_file "pages/DAW.tsx" "useLayoutStore")

log_info "Current implementation state:"
echo "  - store/layout-store.ts:           ${LAYOUT_STORE_EXISTS}"
echo "  - components/ui/panel-resize-handle.tsx: ${RESIZE_HANDLE_EXISTS}"
echo "  - useLayoutStore export in index.ts: ${LAYOUT_EXPORT_EXISTS}"
echo "  - useLayoutStore import in DAW.tsx:  ${DAW_IMPORT_EXISTS}"

if [[ "${LAYOUT_STORE_EXISTS}" == "EXISTS" && "${RESIZE_HANDLE_EXISTS}" == "EXISTS" && "${LAYOUT_EXPORT_EXISTS}" == "FOUND" && "${DAW_IMPORT_EXISTS}" == "FOUND" ]]; then
    log_warn "All changes appear to already be implemented!"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Aborted by user."
        exit 0
    fi
fi

# Phase 1: Backup
log_info "=== PHASE 1: Creating Backups ==="
mkdir -p "${BACKUP_DIR}"
cp "${SRC_DIR}/pages/DAW.tsx" "${BACKUP_DIR}/DAW.tsx.bak"
cp "${SRC_DIR}/store/index.ts" "${BACKUP_DIR}/store-index-ts.bak"
if [[ -f "${SRC_DIR}/store/layout-store.ts" ]]; then
    cp "${SRC_DIR}/store/layout-store.ts" "${BACKUP_DIR}/layout-store.ts.bak"
fi
if [[ -f "${SRC_DIR}/components/ui/panel-resize-handle.tsx" ]]; then
    cp "${SRC_DIR}/components/ui/panel-resize-handle.tsx" "${BACKUP_DIR}/panel-resize-handle.tsx.bak"
fi
log_ok "Backups created in: ${BACKUP_DIR}"

# Phase 2: Create layout-store.ts
log_info "=== PHASE 2: Creating store/layout-store.ts ==="

if [[ ! -f "${SRC_DIR}/store/layout-store.ts" ]]; then
    cat > "${SRC_DIR}/store/layout-store.ts" << 'LAYOUT_STORE_EOF'
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PanelState {
  width: number;
  height: number;
  collapsed: boolean;
  prevWidth?: number;
  prevHeight?: number;
}

interface LayoutState {
  leftPanel: PanelState;
  rightPanel: PanelState;
  bottomPanel: PanelState;
  zoom: number;
  trackHeightMode: 'compact' | 'normal' | 'large';
}

const DEFAULTS: LayoutState = {
  leftPanel:   { width: 180, height: 200, collapsed: false },
  rightPanel:  { width: 280, height: 200, collapsed: false },
  bottomPanel: { width: 200, height: 160, collapsed: false },
  zoom: 1,
  trackHeightMode: 'normal',
};

const MIN_WIDTH = 120;
const MAX_WIDTH = 600;
const MIN_HEIGHT = 80;
const MAX_HEIGHT = 500;

interface LayoutStore extends LayoutState {
  setPanelWidth:  (panel: 'left' | 'right', width: number) => void;
  setPanelHeight: (panel: 'bottom', height: number) => void;
  togglePanel:    (panel: 'left' | 'right' | 'bottom') => void;
  setZoom:        (zoom: number) => void;
  setTrackHeightMode: (mode: 'compact' | 'normal' | 'large') => void;
  resetLayout:    () => void;
}

export const useLayoutStore = create<LayoutStore>()(
  persist(
    (set) => ({
      ...DEFAULTS,

      setPanelWidth: (panel, width) =>
        set((state) => {
          const clamped = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, width));
          const key = panel === 'left' ? 'leftPanel' : 'rightPanel';
          return {
            [key]: {
              ...state[key],
              width: clamped,
              prevWidth: state[key].collapsed ? state[key].prevWidth : clamped,
            },
          } as Partial<LayoutState>;
        }),

      setPanelHeight: (panel, height) =>
        set((state) => {
          const clamped = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, height));
          return {
            bottomPanel: {
              ...state.bottomPanel,
              height: clamped,
              prevHeight: state.bottomPanel.collapsed ? state.bottomPanel.prevHeight : clamped,
            },
          };
        }),

      togglePanel: (panel) =>
        set((state) => {
          if (panel === 'bottom') {
            const { collapsed, height, prevHeight } = state.bottomPanel;
            return {
              bottomPanel: {
                ...state.bottomPanel,
                collapsed: !collapsed,
                height: collapsed ? (prevHeight ?? DEFAULTS.bottomPanel.height) : height,
                prevHeight: collapsed ? prevHeight : height,
              },
            };
          }
          const key = panel === 'left' ? 'leftPanel' : 'rightPanel';
          const { collapsed, width, prevWidth } = state[key];
          return {
            [key]: {
              ...state[key],
              collapsed: !collapsed,
              width: collapsed ? (prevWidth ?? DEFAULTS[key].width) : width,
              prevWidth: collapsed ? prevWidth : width,
            },
          } as Partial<LayoutState>;
        }),

      setZoom: (zoom) =>
        set({ zoom: Math.max(0.1, Math.min(10, zoom)) }),

      setTrackHeightMode: (mode) =>
        set({ trackHeightMode: mode }),

      resetLayout: () => set(DEFAULTS),
    }),
    {
      name: 'daw-layout-v1',
      version: 1,
    }
  )
);

export const selectLeftPanel = (s: LayoutState) => s.leftPanel;
export const selectRightPanel = (s: LayoutState) => s.rightPanel;
export const selectBottomPanel = (s: LayoutState) => s.bottomPanel;
export const selectZoom = (s: LayoutState) => s.zoom;
export const selectTrackHeightMode = (s: LayoutState) => s.trackHeightMode;
LAYOUT_STORE_EOF
    log_ok "Created: store/layout-store.ts"
else
    log_warn "store/layout-store.ts already exists - skipping"
fi

# Phase 3: Create panel-resize-handle.tsx
log_info "=== PHASE 3: Creating components/ui/panel-resize-handle.tsx ==="

if [[ ! -f "${SRC_DIR}/components/ui/panel-resize-handle.tsx" ]]; then
    cat > "${SRC_DIR}/components/ui/panel-resize-handle.tsx" << 'RESIZE_HANDLE_EOF'
import React, { useState, useCallback, useRef } from "react";

interface PanelResizeHandleProps {
  direction: "horizontal" | "vertical";
  onResize: (size: number) => void;
  min: number;
  max: number;
}

export const PanelResizeHandle = React.memo(function PanelResizeHandle({
  direction,
  onResize,
  min,
  max,
}: PanelResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false);
  const startRef = useRef(0);
  const startSizeRef = useRef(0);
  const rafRef = useRef<number>(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);

      startRef.current = direction === "horizontal" ? e.clientX : e.clientY;

      const parent = (e.target as HTMLElement).parentElement;
      if (parent) {
        const rect = parent.getBoundingClientRect();
        startSizeRef.current = direction === "horizontal" ? rect.width : rect.height;
      }

      document.body.style.cursor = direction === "horizontal" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          const current = direction === "horizontal" ? moveEvent.clientX : moveEvent.clientY;
          const delta = current - startRef.current;
          const newSize = Math.max(min, Math.min(max, startSizeRef.current + delta));
          onResize(newSize);
        });
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [direction, min, max, onResize]
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      startRef.current = direction === "horizontal" ? touch.clientX : touch.clientY;

      const parent = (e.target as HTMLElement).parentElement;
      if (parent) {
        const rect = parent.getBoundingClientRect();
        startSizeRef.current = direction === "horizontal" ? rect.width : rect.height;
      }

      const handleTouchMove = (moveEvent: TouchEvent) => {
        const moveTouch = moveEvent.touches[0];
        const current = direction === "horizontal" ? moveTouch.clientX : moveTouch.clientY;
        const delta = current - startRef.current;
        const newSize = Math.max(min, Math.min(max, startSizeRef.current + delta));
        onResize(newSize);
      };

      const handleTouchEnd = () => {
        document.removeEventListener("touchmove", handleTouchMove);
        document.removeEventListener("touchend", handleTouchEnd);
      };

      document.addEventListener("touchmove", handleTouchMove, { passive: true });
      document.addEventListener("touchend", handleTouchEnd);
    },
    [direction, min, max, onResize]
  );

  const isHorizontal = direction === "horizontal";

  return (
    <div
      style={{
        position: "absolute",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: isHorizontal ? "col-resize" : "row-resize",
        background: isDragging ? "rgba(163, 230, 53, 0.08)" : "transparent",
        transition: "background 0.15s ease-out",
        ...(isHorizontal
          ? { right: 0, top: 0, height: "100%", width: 8, marginRight: -4 }
          : { left: 0, bottom: 0, height: 8, width: "100%", marginBottom: -4 }),
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      role="separator"
      aria-orientation={direction}
      aria-label={`Resize panel ${direction}ally`}
      tabIndex={0}
      onKeyDown={(e) => {
        const step = 20;
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          onResize(Math.max(min, startSizeRef.current - step));
        } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault();
          onResize(Math.min(max, startSizeRef.current + step));
        }
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = "rgba(163, 230, 53, 0.04)";
      }}
      onMouseLeave={(e) => {
        if (!isDragging) {
          (e.currentTarget as HTMLElement).style.background = "transparent";
        }
      }}
    >
      <div
        style={{
          borderRadius: 9999,
          transition: "all 0.15s ease-out",
          background: isDragging ? "#a3e635" : "rgba(85, 85, 85, 0.5)",
          boxShadow: isDragging ? "0 0 6px rgba(163, 230, 53, 0.4)" : "none",
          ...(isHorizontal
            ? { height: 32, width: 2 }
            : { height: 2, width: 32 }),
        }}
      />
    </div>
  );
});
RESIZE_HANDLE_EOF
    log_ok "Created: components/ui/panel-resize-handle.tsx"
else
    log_warn "components/ui/panel-resize-handle.tsx already exists - skipping"
fi

# Phase 4: Add export to store/index.ts
log_info "=== PHASE 4: Adding export to store/index.ts ==="

if ! grep -q "export { useAuthStore } from './auth-store';" "${SRC_DIR}/store/index.ts"; then
    log_error "Cannot find expected auth-store export in store/index.ts"
    exit 1
fi

if grep -q "useLayoutStore" "${SRC_DIR}/store/index.ts"; then
    log_warn "useLayoutStore export already exists - skipping"
else
    echo "" >> "${SRC_DIR}/store/index.ts"
    echo "export { useLayoutStore } from './layout-store';" >> "${SRC_DIR}/store/index.ts"
    log_ok "Added: useLayoutStore export to store/index.ts"
fi

# Phase 5: Modify DAW.tsx
log_info "=== PHASE 5: Modifying pages/DAW.tsx ==="

DAW_FILE="${SRC_DIR}/pages/DAW.tsx"
FILE_SIZE=$(wc -c < "${DAW_FILE}")
if [[ ${FILE_SIZE} -lt 100000 ]]; then
    log_error "DAW.tsx seems too small (${FILE_SIZE} bytes). Expected >100KB. Aborting."
    exit 1
fi

# 5.1: Add imports
log_info "5.1: Adding imports..."
if grep -q "useLayoutStore" "${DAW_FILE}"; then
    log_warn "useLayoutStore already imported - skipping"
else
    if grep -q "import { SessionSummaryPanel } from '../components/session-summary/SessionSummaryPanel';" "${DAW_FILE}"; then
        sed -i "/import { SessionSummaryPanel } from '..\/components\/session-summary\/SessionSummaryPanel';/a\
import { useLayoutStore } from '../store/layout-store';\nimport { PanelResizeHandle } from '../components/ui/panel-resize-handle';" "${DAW_FILE}"
        log_ok "Added imports"
    else
        log_error "Cannot find SessionSummaryPanel import anchor"
        exit 1
    fi
fi

# 5.2: Add layout hooks
log_info "5.2: Adding layout store hooks..."
if grep -q "const leftPanel = useLayoutStore" "${DAW_FILE}"; then
    log_warn "Layout hooks already present - skipping"
else
    TEMP_DAW=$(mktemp)
    awk '
    /useEffect\(\(\) => \{ setIsInitialized\(true\); \}, \[\]\);/ {
        print
        print ""
        print "  // Layout store - panel geometry and visibility"
        print "  const leftPanel = useLayoutStore(s => s.leftPanel);"
        print "  const rightPanel = useLayoutStore(s => s.rightPanel);"
        print "  const bottomPanel = useLayoutStore(s => s.bottomPanel);"
        print "  const setPanelWidth = useLayoutStore(s => s.setPanelWidth);"
        print "  const setPanelHeight = useLayoutStore(s => s.setPanelHeight);"
        print "  const togglePanel = useLayoutStore(s => s.togglePanel);"
        print "  const resetLayout = useLayoutStore(s => s.resetLayout);"
        print "  const layoutZoom = useLayoutStore(s => s.zoom);"
        print "  const setLayoutZoom = useLayoutStore(s => s.setZoom);"
        print "  const layoutTrackHeight = useLayoutStore(s => s.trackHeightMode);"
        print "  const setLayoutTrackHeight = useLayoutStore(s => s.setTrackHeightMode);"
        next
    }
    { print }
    ' "${DAW_FILE}" > "${TEMP_DAW}"
    mv "${TEMP_DAW}" "${DAW_FILE}"
    log_ok "Added layout hooks"
fi

# 5.3: Add sync effects
log_info "5.3: Adding sync effects..."
if grep -q "Keep DAW store in sync with layout store" "${DAW_FILE}"; then
    log_warn "Sync effects already present - skipping"
else
    TEMP_DAW=$(mktemp)
    awk '
    /const setLayoutTrackHeight = useLayoutStore/ {
        print
        print ""
        print "  // Keep DAW store in sync with layout store for existing components"
        print "  useEffect(() => {"
        print "    const dawSetZoom = useDAWStore.getState().setZoom;"
        print "    if (dawSetZoom && dawSetZoom !== setLayoutZoom) dawSetZoom(layoutZoom);"
        print "  }, [layoutZoom]);"
        print ""
        print "  useEffect(() => {"
        print "    const dawSetHeight = useDAWStore.getState().setTrackHeightMode;"
        print "    if (dawSetHeight && dawSetHeight !== setLayoutTrackHeight) dawSetHeight(layoutTrackHeight);"
        print "  }, [layoutTrackHeight]);"
        next
    }
    { print }
    ' "${DAW_FILE}" > "${TEMP_DAW}"
    mv "${TEMP_DAW}" "${DAW_FILE}"
    log_ok "Added sync effects"
fi

# 5.4: Add keyboard shortcuts
log_info "5.4: Adding keyboard shortcuts..."
if grep -q "'ctrl+1': () => togglePanel" "${DAW_FILE}"; then
    log_warn "Panel shortcuts already present - skipping"
else
    TEMP_DAW=$(mktemp)
    awk '
    /"\?": \(\) => setShowHelp\(true\),/ {
        print
        print "    '\''ctrl+1'\'': () => togglePanel('\''left'\''),"
        print "    '\''ctrl+2'\'': () => { /* focus center */ },"
        print "    '\''ctrl+3'\'': () => togglePanel('\''right'\''),"
        print "    '\''ctrl+4'\'': () => togglePanel('\''bottom'\''),"
        print "    '\''ctrl+0'\'': () => resetLayout(),"
        next
    }
    { print }
    ' "${DAW_FILE}" > "${TEMP_DAW}"
    mv "${TEMP_DAW}" "${DAW_FILE}"
    log_ok "Added keyboard shortcuts"
fi

# 5.5: Replace layout JSX (using Python for precision)
log_info "5.5: Replacing main content area layout..."
if grep -q "Main content area - resizable panels" "${DAW_FILE}"; then
    log_warn "Resizable layout already present - skipping"
else
    cat > /tmp/daw_layout_patch.py << 'PYTHON_EOF'
import sys
with open(sys.argv[1], 'r') as f:
    content = f.read()

if 'Main content area - resizable panels' in content:
    print("Already patched")
    sys.exit(0)

old_block = '''        {/* Main content area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar */}
          <Sidebar collab={collab} />

          {/* Center column: arrangement + optional MIDI sequencer */}
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Arrangement view */}
            <ArrangementView engine={engine} collab={collab} />

            {/* MIDI Sequencer - collapsible (Level 2) */}
            {sequencerVisible && (
              <MidiSequencerPanel seq={seq} />
            )}

            {/* Mixer + FX rack */}
            <MixerStrip engine={engine} />
          </div>

          {/* Right AI panel - collapsible (L1 + L3) */}
          {aiPanelVisible && <AIPanel />}
        </div>'''

new_block = '''        {/* Main content area - resizable panels */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar - resizable + collapsible */}
          <div
            style={{
              width: leftPanel.collapsed ? 32 : leftPanel.width,
              minWidth: leftPanel.collapsed ? 32 : 120,
              maxWidth: 600,
              transition: leftPanel.collapsed ? 'width 0.2s ease-out' : 'none',
              position: 'relative',
              flexShrink: 0,
              borderRight: '1px solid #1c1c1c',
            }}
          >
            {!leftPanel.collapsed && <Sidebar collab={collab} />}
            {leftPanel.collapsed && (
              <div
                style={{
                  width: 32, height: '100%', display: 'flex',
                  flexDirection: 'column', alignItems: 'center',
                  paddingTop: 8, gap: 8, cursor: 'pointer',
                }}
                onClick={() => togglePanel('left')}
                title="Expand sidebar (Ctrl+1)"
                role="button"
                aria-label="Expand left sidebar"
              >
                <span style={{ fontSize: 10, color: '#555', writingMode: 'vertical-rl', letterSpacing: 2 }}>
                  SIDEBAR
                </span>
                <div style={{ width: 2, flex: 1, background: '#1c1c1c' }} />
              </div>
            )}
            {!leftPanel.collapsed && (
              <PanelResizeHandle
                direction="horizontal"
                onResize={(w) => setPanelWidth('left', w)}
                min={120}
                max={400}
              />
            )}
            {!leftPanel.collapsed && (
              <button
                onClick={() => togglePanel('left')}
                style={{
                  position: 'absolute', top: 4, right: 8,
                  background: 'transparent', border: 'none',
                  color: '#555', fontSize: 10, cursor: 'pointer', zIndex: 10,
                }}
                title="Collapse sidebar (Ctrl+1)"
                aria-label="Collapse left sidebar"
              >
                &lt;
              </button>
            )}
          </div>

          {/* Center column */}
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Arrangement view */}
            <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
              <ArrangementView engine={engine} collab={collab} />
            </div>

            {/* MIDI Sequencer */}
            {sequencerVisible && <MidiSequencerPanel seq={seq} />}

            {/* Mixer - resizable height */}
            <div
              style={{
                height: bottomPanel.collapsed ? 32 : bottomPanel.height,
                minHeight: bottomPanel.collapsed ? 32 : 80,
                maxHeight: 500,
                transition: bottomPanel.collapsed ? 'height 0.2s ease-out' : 'none',
                position: 'relative',
                flexShrink: 0,
                borderTop: '1px solid #1c1c1c',
              }}
            >
              {!bottomPanel.collapsed && <MixerStrip engine={engine} />}
              {bottomPanel.collapsed && (
                <div
                  style={{
                    height: 32, display: 'flex', alignItems: 'center',
                    paddingLeft: 16, gap: 8, cursor: 'pointer',
                  }}
                  onClick={() => togglePanel('bottom')}
                  title="Expand mixer (Ctrl+4)"
                  role="button"
                  aria-label="Expand mixer panel"
                >
                  <span style={{ fontSize: 10, color: '#555', letterSpacing: 2 }}>MIXER</span>
                  <div style={{ height: 2, flex: 1, background: '#1c1c1c' }} />
                </div>
              )}
              {!bottomPanel.collapsed && (
                <PanelResizeHandle
                  direction="vertical"
                  onResize={(h) => setPanelHeight('bottom', h)}
                  min={80}
                  max={400}
                />
              )}
              {!bottomPanel.collapsed && (
                <button
                  onClick={() => togglePanel('bottom')}
                  style={{
                    position: 'absolute', top: 4, right: '50%',
                    transform: 'translateX(50%)',
                    background: 'transparent', border: 'none',
                    color: '#555', fontSize: 10, cursor: 'pointer', zIndex: 10,
                  }}
                  title="Collapse mixer (Ctrl+4)"
                  aria-label="Collapse mixer panel"
                >
                  v
                </button>
              )}
            </div>
          </div>

          {/* Right AI panel - resizable + collapsible */}
          {aiPanelVisible && (
            <div
              style={{
                width: rightPanel.collapsed ? 32 : rightPanel.width,
                minWidth: rightPanel.collapsed ? 32 : 200,
                maxWidth: 600,
                transition: rightPanel.collapsed ? 'width 0.2s ease-out' : 'none',
                position: 'relative',
                flexShrink: 0,
                borderLeft: '1px solid #1c1c1c',
              }}
            >
              {!rightPanel.collapsed && <AIPanel />}
              {rightPanel.collapsed && (
                <div
                  style={{
                    width: 32, height: '100%', display: 'flex',
                    flexDirection: 'column', alignItems: 'center',
                    paddingTop: 8, gap: 8, cursor: 'pointer',
                  }}
                  onClick={() => togglePanel('right')}
                  title="Expand AI panel (Ctrl+3)"
                  role="button"
                  aria-label="Expand AI panel"
                >
                  <span style={{ fontSize: 10, color: '#555', writingMode: 'vertical-rl', letterSpacing: 2 }}>
                    AI
                  </span>
                  <div style={{ width: 2, flex: 1, background: '#1c1c1c' }} />
                </div>
              )}
              {!rightPanel.collapsed && (
                <PanelResizeHandle
                  direction="horizontal"
                  onResize={(w) => setPanelWidth('right', w)}
                  min={200}
                  max={500}
                />
              )}
              {!rightPanel.collapsed && (
                <button
                  onClick={() => togglePanel('right')}
                  style={{
                    position: 'absolute', top: 4, left: 8,
                    background: 'transparent', border: 'none',
                    color: '#555', fontSize: 10, cursor: 'pointer', zIndex: 10,
                  }}
                  title="Collapse AI panel (Ctrl+3)"
                  aria-label="Collapse AI panel"
                >
                  &gt;
                </button>
              )}
            </div>
          )}
        </div>'''

if old_block in content:
    content = content.replace(old_block, new_block)
    with open(sys.argv[1], 'w') as f:
        f.write(content)
    print("Layout replaced successfully")
else:
    print("ERROR: Could not find exact layout block to replace")
    sys.exit(1)
PYTHON_EOF

    python3 /tmp/daw_layout_patch.py "${DAW_FILE}"
    if [[ $? -eq 0 ]]; then
        log_ok "Replaced layout block"
    else
        log_error "Failed to replace layout block"
        exit 1
    fi
fi

# Phase 6: TypeScript check
log_info "=== PHASE 6: TypeScript Verification ==="
cd "${PROJECT_ROOT}/client"
if command -v pnpm &> /dev/null; then
    log_info "Running pnpm tsc --noEmit..."
    if pnpm tsc --noEmit 2>&1 | tee "${BACKUP_DIR}/tsc-output.log"; then
        log_ok "TypeScript check passed!"
    else
        log_warn "TypeScript errors detected (see ${BACKUP_DIR}/tsc-output.log)"
        read -p "Continue despite errors? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Restoring backups..."
            cp "${BACKUP_DIR}/DAW.tsx.bak" "${SRC_DIR}/pages/DAW.tsx"
            cp "${BACKUP_DIR}/store-index-ts.bak" "${SRC_DIR}/store/index.ts"
            rm -f "${SRC_DIR}/store/layout-store.ts"
            rm -f "${SRC_DIR}/components/ui/panel-resize-handle.tsx"
            log_ok "Restored to original state"
            exit 1
        fi
    fi
else
    log_warn "pnpm not found - skipping TypeScript check"
fi

# Phase 7: Final Verification
log_info "=== PHASE 7: Final Verification ==="
VERIFICATION_PASSED=true

checks=(
    "store/layout-store.ts:EXISTS"
    "components/ui/panel-resize-handle.tsx:EXISTS"
    "store/index.ts:useLayoutStore"
    "pages/DAW.tsx:useLayoutStore"
    "pages/DAW.tsx:PanelResizeHandle"
    "pages/DAW.tsx:Main content area - resizable panels"
    "pages/DAW.tsx:ctrl+1"
    "pages/DAW.tsx:togglePanel"
)

for check in "${checks[@]}"; do
    IFS=':' read -r file pattern <<< "${check}"
    if [[ "${pattern}" == "EXISTS" ]]; then
        if [[ -f "${SRC_DIR}/${file}" ]]; then
            log_ok "OK ${file} exists"
        else
            log_error "FAIL ${file} missing"
            VERIFICATION_PASSED=false
        fi
    else
        if grep -q "${pattern}" "${SRC_DIR}/${file}" 2>/dev/null; then
            log_ok "OK ${file} contains '${pattern}'"
        else
            log_error "FAIL ${file} missing '${pattern}'"
            VERIFICATION_PASSED=false
        fi
    fi
done

# Summary
echo ""
log_info "=== SUMMARY ==="
echo "  Backup location: ${BACKUP_DIR}"
echo "  Files created:"
echo "    - store/layout-store.ts"
echo "    - components/ui/panel-resize-handle.tsx"
echo "  Files modified:"
echo "    - store/index.ts (added export)"
echo "    - pages/DAW.tsx (layout + hooks + shortcuts)"
echo ""

if [[ "${VERIFICATION_PASSED}" == true ]]; then
    log_ok "ALL VERIFICATIONS PASSED"
    echo ""
    log_info "Next steps:"
    echo "  1. cd ~/Stable/client && pnpm dev"
    echo "  2. Open browser at http://localhost:5173"
    echo "  3. Test: drag sidebar edges, click collapse buttons, use Ctrl+1/3/4/0"
    echo "  4. Check browser console for runtime errors"
    echo ""
    log_info "To rollback: cp ${BACKUP_DIR}/*.bak ${SRC_DIR}/..."
else
    log_warn "Some verifications failed - check logs above"
    log_warn "Backups available at: ${BACKUP_DIR}"
fi
