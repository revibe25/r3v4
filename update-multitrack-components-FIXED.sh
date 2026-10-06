#!/bin/bash

################################################################################
# R3 NATIVE Multitrack v1.3.0 - Component Integration Script
# 
# Purpose: Safely update MultitrackV130.tsx with new component imports and usage
# Usage: bash update-multitrack-components.sh
# 
# Features:
# - Creates backup of original file
# - Validates file exists
# - Adds component imports
# - Integrates components into JSX
# - Verifies changes
# - Rolls back on failure
################################################################################

set -e  # Exit on any error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'  # No Color

# Paths
PROJECT_ROOT="$HOME/Projects/r3v4"
TARGET_FILE="$PROJECT_ROOT/client/src/features/multitrack-v130/MultitrackV130.tsx"
BACKUP_FILE="${TARGET_FILE}.backup-$(date +%Y%m%d-%H%M%S)"

################################################################################
# Utility Functions
################################################################################

log_info() {
  echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
  echo -e "${RED}❌ $1${NC}"
}

die() {
  log_error "$1"
  exit 1
}

################################################################################
# Validation
################################################################################

log_info "Starting R3 NATIVE Multitrack Component Integration"
echo ""

# Check if project exists
if [ ! -d "$PROJECT_ROOT" ]; then
  die "Project directory not found: $PROJECT_ROOT"
fi

log_success "Project directory found"

# Check if target file exists
if [ ! -f "$TARGET_FILE" ]; then
  die "Target file not found: $TARGET_FILE"
fi

log_success "Target file found: $TARGET_FILE"

# Check if components directory has files
COMPONENTS_DIR="$PROJECT_ROOT/client/src/features/multitrack-v130/components"
if [ ! -d "$COMPONENTS_DIR" ]; then
  die "Components directory not found: $COMPONENTS_DIR"
fi

COMPONENT_COUNT=$(ls -1 "$COMPONENTS_DIR"/*.tsx 2>/dev/null | wc -l)
if [ "$COMPONENT_COUNT" -eq 0 ]; then
  die "No component files found in $COMPONENTS_DIR"
fi

log_success "Found $COMPONENT_COUNT component files"
echo ""

################################################################################
# Backup Original File
################################################################################

log_info "Creating backup..."
cp "$TARGET_FILE" "$BACKUP_FILE"
log_success "Backup created: $BACKUP_FILE"
echo ""

################################################################################
# Generate New Content
################################################################################

log_info "Generating updated component file..."

NEW_CONTENT='import {
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { getAudioGraph } from "@/audio/core/audio-graph";
import { useV130Runtime } from "./runtime/useV130Runtime";
import { useV130CanvasRegistry } from "./renderers/useV130CanvasRegistry";
import { useV130PresentationRuntime } from "./renderers/useV130PresentationRuntime";
import { useV130Viewport } from "./layout/useV130Viewport";
import V130ReferenceDomShell from "./reference/V130ReferenceDomShell";

// NEW: Import the generated components
import {
  HeaderBrand,
  ClockDisplay,
  PanKnob,
  SendFader,
  ParameterKnob,
  PluginEditor,
  AutomationLane,
  ArrangeMarkers,
  StatusBar,
  Footer,
} from "./components";

import "./styles/reference.css";
import "./styles/host.css";

export default function MultitrackV130() {
  const hostRef = useRef<HTMLDivElement | null>(null);

  const [host, setHost] = useState<HTMLDivElement | null>(null);

  // Initialize the shared audio graph singleton once and expose it
  // through React state so dependent runtimes receive the live instance.
  const [audioGraph, setAudioGraph] = useState<
    ReturnType<typeof getAudioGraph> | null
  >(null);

  useLayoutEffect(() => {
    const graph = getAudioGraph();
    setAudioGraph(graph);
    (window as any).__audioGraph = graph;
  }, []);

  const viewport = useV130Viewport(host);

  const canvasRegistry = useV130CanvasRegistry(hostRef, viewport);

  useV130PresentationRuntime(
    hostRef,
    viewport,
    canvasRegistry,
    audioGraph
  );

  useV130Runtime(hostRef);

  return (
    <div
      ref={(node) => {
        hostRef.current = node;
        setHost(node);
      }}
      className="r3-multitrack-v130"
      data-v130-root="true"
      data-v130-stage-width={viewport.logicalWidth}
      data-v130-stage-height={viewport.logicalHeight}
      data-v130-scale={viewport.scale}
      aria-label="R3 NATIVE Multitrack v1.3.0"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        width: "100vw",
      }}
    >
      {/* NEW: Header with branding and clock */}
      <div
        style={{
          borderBottom: "1px solid #16252c",
          flexShrink: 0,
        }}
      >
        <HeaderBrand />
        <ClockDisplay playheadPosition={0} tempo={120} format="both" />
      </div>

      {/* Canvas-based render system */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          minHeight: 0,
        }}
      >
        <V130ReferenceDomShell viewport={viewport} audioGraph={audioGraph} />
      </div>

      {/* NEW: Status bar with CPU/RAM/Disk metrics */}
      <div style={{ flexShrink: 0 }}>
        <StatusBar
          cpuUsage={0}
          memoryUsage={0}
          bufferStatus="ready"
          renderStatus="idle"
        />
      </div>

      {/* NEW: Footer with version and links */}
      <div style={{ flexShrink: 0 }}>
        <Footer version="1.3.0" buildNumber="v130" />
      </div>
    </div>
  );
}
'

################################################################################
# Write New Content
################################################################################

log_info "Writing updated content to file..."

# Use a temp file to ensure atomic write
TEMP_FILE="${TARGET_FILE}.tmp"
echo "$NEW_CONTENT" > "$TEMP_FILE"

# Verify write was successful
if [ ! -f "$TEMP_FILE" ]; then
  die "Failed to write temporary file"
fi

# Move temp file to target
mv "$TEMP_FILE" "$TARGET_FILE"

log_success "File updated successfully"
echo ""

################################################################################
# Verification
################################################################################

log_info "Verifying changes..."

# Check for key imports
if grep -q "import.*HeaderBrand" "$TARGET_FILE"; then
  log_success "✓ HeaderBrand import found"
else
  die "HeaderBrand import not found after update"
fi

if grep -q "import.*ClockDisplay" "$TARGET_FILE"; then
  log_success "✓ ClockDisplay import found"
else
  die "ClockDisplay import not found after update"
fi

if grep -q "import.*StatusBar" "$TARGET_FILE"; then
  log_success "✓ StatusBar import found"
else
  die "StatusBar import not found after update"
fi

if grep -q "import.*Footer" "$TARGET_FILE"; then
  log_success "✓ Footer import found"
else
  die "Footer import not found after update"
fi

# Check for component usage
if grep -q "<HeaderBrand" "$TARGET_FILE"; then
  log_success "✓ HeaderBrand component usage found"
else
  die "HeaderBrand component usage not found after update"
fi

if grep -q "<StatusBar" "$TARGET_FILE"; then
  log_success "✓ StatusBar component usage found"
else
  die "StatusBar component usage not found after update"
fi

echo ""

################################################################################
# Build Verification
################################################################################

log_info "Running TypeScript build verification..."

cd "$PROJECT_ROOT"

# Try to build just the client
if pnpm build 2>&1 | grep -q "error"; then
  log_warning "Build completed with errors"
  log_warning "Attempting to restore from backup..."
  cp "$BACKUP_FILE" "$TARGET_FILE"
  die "Build failed. Original file restored from: $BACKUP_FILE"
else
  log_success "TypeScript build passed with no errors"
fi

echo ""

################################################################################
# Success Summary
################################################################################

log_success "✨ Integration Complete!"
echo ""
echo "📊 Summary:"
echo "  • File updated: $TARGET_FILE"
echo "  • Backup saved: $BACKUP_FILE"
echo "  • Components imported: 10"
echo "  • Build status: ✅ PASSED"
echo ""
echo "🚀 Next steps:"
echo "  1. Start dev server: cd $PROJECT_ROOT && pnpm dev"
echo "  2. Open browser: http://localhost:5174"
echo "  3. You should see the new UI components!"
echo ""
echo "💡 To view the updated file:"
echo "  cat $TARGET_FILE"
echo ""
echo "🔄 To restore the original (if needed):"
echo "  cp $BACKUP_FILE $TARGET_FILE"
echo ""

log_success "Done! ✅"
