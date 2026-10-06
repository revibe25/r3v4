#!/bin/bash

################################################################################
#                                                                              #
#  R3 NATIVE MULTITRACK — AUTOMATION SETUP FOR R3V MACHINE                  #
#                                                                              #
#  Downloads automation system from Claude.ai outputs and sets up locally    #
#                                                                              #
#  Usage: bash SETUP_AUTOMATION_ON_R3V.sh [destination_dir]                 #
#  Default destination: ~/multitrack-automation                              #
#                                                                              #
################################################################################

set -euo pipefail

# Configuration
DEST_DIR="${1:-$HOME/multitrack-automation}"
CLAUDE_SRC="/home/claude"
COLOR_GREEN='\033[0;32m'
COLOR_BLUE='\033[0;34m'
COLOR_RED='\033[0;31m'
NC='\033[0m'

# Functions
log_info() { echo -e "${COLOR_BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${COLOR_GREEN}[✓]${NC} $1"; }
log_error() { echo -e "${COLOR_RED}[✗]${NC} $1"; }

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  R3 NATIVE MULTITRACK — AUTOMATION SETUP                 ║"
echo "║  Installing to: $DEST_DIR"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Create destination directory
log_info "Creating destination directory..."
mkdir -p "$DEST_DIR"
log_success "Created: $DEST_DIR"

# Copy automation scripts
log_info "Copying automation scripts..."
cp "$CLAUDE_SRC/MULTITRACK_ORCHESTRATOR.sh" "$DEST_DIR/"
cp "$CLAUDE_SRC/MULTITRACK_AUTOMATION_MASTER.sh" "$DEST_DIR/"
cp "$CLAUDE_SRC/MULTITRACK_CI_CD_PIPELINE.sh" "$DEST_DIR/"
log_success "Copied 3 automation scripts"

# Copy documentation
log_info "Copying documentation..."
cp "$CLAUDE_SRC/START_HERE.txt" "$DEST_DIR/"
cp "$CLAUDE_SRC/README_AUTOMATION_SYSTEM.md" "$DEST_DIR/"
cp "$CLAUDE_SRC/AUTOMATION_QUICK_REFERENCE.txt" "$DEST_DIR/"
cp "$CLAUDE_SRC/MULTITRACK_AUTOMATION_GUIDE.md" "$DEST_DIR/"
cp "$CLAUDE_SRC/AUTOMATION_DELIVERY_SUMMARY.md" "$DEST_DIR/"
log_success "Copied 5 documentation files"

# Make scripts executable
log_info "Making scripts executable..."
chmod +x "$DEST_DIR"/*.sh
log_success "All scripts are now executable"

# List what was installed
echo ""
echo "════════════════════════════════════════════════════════════"
log_success "INSTALLATION COMPLETE"
echo "════════════════════════════════════════════════════════════"
echo ""
log_info "Installation location: $DEST_DIR"
echo ""
log_info "Files installed:"
ls -1 "$DEST_DIR" | sed 's/^/  • /'
echo ""
log_info "Next steps:"
echo "  1. cd $DEST_DIR"
echo "  2. cat START_HERE.txt"
echo "  3. bash MULTITRACK_ORCHESTRATOR.sh"
echo ""
echo "════════════════════════════════════════════════════════════"
echo ""

# Verify installation
if [ -f "$DEST_DIR/MULTITRACK_ORCHESTRATOR.sh" ] && \
   [ -f "$DEST_DIR/MULTITRACK_AUTOMATION_MASTER.sh" ] && \
   [ -f "$DEST_DIR/MULTITRACK_CI_CD_PIPELINE.sh" ]; then
  log_success "Automation system ready to use!"
  echo ""
  echo "Quick start:"
  echo "  cd $DEST_DIR && bash MULTITRACK_ORCHESTRATOR.sh"
else
  log_error "Installation verification failed"
  exit 1
fi
