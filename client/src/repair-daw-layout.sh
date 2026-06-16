#!/usr/bin/env bash
# DAW Layout Polish - Repair Script (Phase 5.5 only)
# Uses marker-based replacement to avoid Unicode matching issues

set -euo pipefail

PROJECT_ROOT="${HOME}/Stable"
SRC_DIR="${PROJECT_ROOT}/client/src"
DAW_FILE="${SRC_DIR}/pages/DAW.tsx"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}   $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

log_info "=== Repair Script: Layout Block Replacement ==="

if [[ ! -f "${DAW_FILE}" ]]; then
    log_error "DAW.tsx not found at ${DAW_FILE}"
    exit 1
fi

# Check if already patched
if grep -q "Main content area - resizable panels" "${DAW_FILE}"; then
    log_ok "Layout already patched - nothing to do"
    exit 0
fi

# Check if previous phases were applied
if ! grep -q "useLayoutStore" "${DAW_FILE}"; then
    log_error "Previous phases not found. Run apply-daw-layout-polish.sh first."
    exit 1
fi

log_info "Creating backup..."
BACKUP_DIR="${PROJECT_ROOT}/.backups/daw-layout-repair-$(date +%Y%m%d-%H%M%S)"
mkdir -p "${BACKUP_DIR}"
cp "${DAW_FILE}" "${BACKUP_DIR}/DAW.tsx.bak"

log_info "Replacing layout block using Python (marker-based)..."

python3 << 'PYEOF'
import sys

with open("/home/r3v/Stable/client/src/pages/DAW.tsx", "r") as f:
    content = f.read()

# Find by start/end markers (avoids Unicode issues)
start_marker = '{/* Main content area */}'
end_marker = '{aiPanelVisible && <AIPanel />}'

start_idx = content.find(start_marker)
if start_idx == -1:
    print("ERROR: Could not find start marker: " + start_marker)
    sys.exit(1)

end_idx = content.find(end_marker, start_idx)
if end_idx == -1:
    print("ERROR: Could not find end marker: " + end_marker)
    sys.exit(1)

# Find the closing div after the end marker
end_div_idx = content.find('</div>', end_idx)
if end_div_idx == -1:
    print("ERROR: Could not find closing </div> after end marker")
    sys.exit(1)

# Extract the old block
old_block = content[start_idx:end_div_idx+6]
print(f"Found layout block: {len(old_block)} chars")

# New layout block
new_block = '''{/* Main content area - resizable panels */}
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

# Replace
content = content[:start_idx] + new_block + content[end_div_idx+6:]

with open("/home/r3v/Stable/client/src/pages/DAW.tsx", "w") as f:
    f.write(content)

print("SUCCESS: Layout block replaced")
PYEOF

if [[ $? -eq 0 ]]; then
    log_ok "Layout block replaced successfully"
else
    log_error "Failed to replace layout block"
    log_info "Restoring from backup..."
    cp "${BACKUP_DIR}/DAW.tsx.bak" "${DAW_FILE}"
    log_ok "Restored from backup"
    exit 1
fi

log_info "=== Verification ==="
if grep -q "Main content area - resizable panels" "${DAW_FILE}"; then
    log_ok "Layout replacement verified"
else
    log_error "Layout replacement not found in file"
    exit 1
fi

if grep -q "PanelResizeHandle" "${DAW_FILE}"; then
    log_ok "PanelResizeHandle usage verified"
else
    log_warn "PanelResizeHandle not found in layout"
fi

if grep -q "togglePanel" "${DAW_FILE}"; then
    log_ok "togglePanel usage verified"
else
    log_warn "togglePanel not found in layout"
fi

log_info "=== Summary ==="
log_ok "Repair complete!"
echo "  Backup: ${BACKUP_DIR}/DAW.tsx.bak"
echo ""
echo "Next steps:"
echo "  1. cd ~/Stable/client && pnpm tsc --noEmit"
echo "  2. pnpm dev"
echo "  3. Test: Ctrl+1/3/4 for panel toggle, drag edges to resize"
