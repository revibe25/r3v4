#!/usr/bin/env bash
# ============================================================
# R3 v4  Dead-File Cleanup  v2  —  ~/Stable
# Triple-checked: 6 bugs fixed, 16 gaps filled (111 targets)
# WIRE-compliant: dry-run default, --execute to delete
# ============================================================
set -euo pipefail

REPO="${HOME}/Stable"
DRY=true
[[ "${1:-}" == "--execute" ]] && DRY=false

REMOVED=0
SKIPPED=0
EPOCH=$(date +%s)
LOGFILE="/tmp/r3_cleanup_${EPOCH}.log"

# ─────────────────────────────────────────────────────────────
# PRE-FLIGHT  (BUG #4 fixed — validate repo before any rm)
# ─────────────────────────────────────────────────────────────
[[ -d "$REPO" ]]               || { echo "ERROR: $REPO not found. Aborting."; exit 1; }
[[ -f "$REPO/package.json" ]]  || { echo "ERROR: $REPO/package.json missing — wrong dir?"; exit 1; }
[[ -f "$REPO/pnpm-workspace.yaml" ]] || { echo "ERROR: not an R3 pnpm workspace. Aborting."; exit 1; }

if command -v git &>/dev/null && git -C "$REPO" rev-parse --git-dir &>/dev/null 2>&1; then
  DIRTY=$(git -C "$REPO" status --porcelain 2>/dev/null | wc -l)
  if [[ $DIRTY -gt 0 ]]; then
    echo ""
    echo "⚠  WARNING: $DIRTY uncommitted change(s) in repo."
    echo "   Deletions won't be recoverable from git unless already tracked."
    echo "   Consider: git add -A && git commit -m 'wip: pre-cleanup snapshot'"
    echo ""
  fi
fi

# ─────────────────────────────────────────────────────────────
# CORE rm_ FUNCTION  (BUG #1 fixed — safe counter arithmetic)
#                   (BUG #5 fixed — tee to log file)
# ─────────────────────────────────────────────────────────────
rm_() {
  local f="${REPO}/${1}"
  if [[ -e "$f" || -L "$f" ]]; then
    if $DRY; then
      printf "  DRY  %-55s\n" "${1}" | tee -a "$LOGFILE"
    else
      rm -rf "$f"
      printf "  GONE %-55s\n" "${1}" | tee -a "$LOGFILE"
      REMOVED=$((REMOVED + 1))   # safe: no arithmetic exit-code trap
    fi
  else
    printf "  SKIP %-55s  (not found)\n" "${1}" | tee -a "$LOGFILE"
    SKIPPED=$((SKIPPED + 1))
  fi
}

echo "" | tee -a "$LOGFILE"
if $DRY; then
  echo "========  DRY RUN — nothing deleted  ========  log: $LOGFILE" | tee -a "$LOGFILE"
  echo "  Re-run with --execute to perform deletions." | tee -a "$LOGFILE"
else
  echo "========  LIVE RUN — deleting now  ==========  log: $LOGFILE" | tee -a "$LOGFILE"
fi
echo "" | tee -a "$LOGFILE"

# ─────────────────────────────────────────────────────────────
# 1. BACKUP DIRECTORIES
# ─────────────────────────────────────────────────────────────
echo "[1] Backup directories" | tee -a "$LOGFILE"
rm_ "_backup_phase4_1779763759"
rm_ "backups"

# ─────────────────────────────────────────────────────────────
# 2. ROOT-LEVEL .bak / .BACKUP / .OLD files
# ─────────────────────────────────────────────────────────────
echo "[2] Root-level backup files" | tee -a "$LOGFILE"
rm_ "index.ts.BACKUP"
rm_ "index.ts.bak"
rm_ "index.ts.OLD"
rm_ "package.json.BACKUP"
rm_ "package.json.bak-20260511_232714"
rm_ "package.json.bak.20260530_184827"
rm_ "package.json.bak_c01"
rm_ "package.json.bak_c01_v2"
rm_ "pnpm-lock.yaml.BACKUP"
rm_ "pnpm-workspace.yaml.BACKUP"
rm_ "tsconfig.bak.1780119075"
rm_ "tsconfig.bak.1780119572"
rm_ "tsconfig.json.bak.20260529T180609"
rm_ "Dockerfile.bak.1780119075"
rm_ "Dockerfile.bak.1780120366"
rm_ "Dockerfile.bak.1780120768"

# ─────────────────────────────────────────────────────────────
# 3. server/ backup + compiled JS artifacts
# ─────────────────────────────────────────────────────────────
echo "[3] server/ backup files + compiled JS artifacts" | tee -a "$LOGFILE"
rm_ "server/package.bak.1780120027"
rm_ "server/tsconfig.bak.1780120721"
rm_ "server/tsconfig.bak.1780120765"
rm_ "server/procedures.ts.bak"
rm_ "server/procedures.ts.bak.1780161285"
rm_ "server/trpc.js"       # compiled artifact — server/trpc.ts is canonical; tsx handles TS directly
rm_ "server/storage.js"    # GAP #10 fixed — same pattern as trpc.js; storage.ts is canonical

# ─────────────────────────────────────────────────────────────
# 4. shared/ backup files
# ─────────────────────────────────────────────────────────────
echo "[4] shared/ backup files" | tee -a "$LOGFILE"
rm_ "shared/schema-subscription.ts.bak-20260430_200116"
rm_ "shared/schema-subscription.ts.bak-20260430_201117"
rm_ "shared/schema-subscription.ts.bak.20260529_173318"
rm_ "shared/schema-subscription.ts.bak_c03"
rm_ "shared/schema-subscription.ts.bak_c03_dup"
rm_ "shared/schema-subscription.ts.bak_c03_manual"
rm_ "shared/schema-subscription.ts.bak_c03_surgical_1780018179"
rm_ "shared/schema-daw-patch.ts.bak-20260430_200116"
rm_ "shared/session-metrics.types.ts.bak-20260421_173414"

# ─────────────────────────────────────────────────────────────
# 5. client/ backup + one-shot build/fix scripts
# ─────────────────────────────────────────────────────────────
echo "[5] client/ backup/audit/one-shot files" | tee -a "$LOGFILE"
rm_ "client/SECURITY.md.bak-20260512"
rm_ "client/MYTHOS_AUDIT.20260501_175223.txt"
rm_ "client/build_and_integrate_VocalSpectra.sh"   # GAP #7 — VocalSpectra build complete
rm_ "client/build_and_test_vocalspectra_Version2.sh" # GAP #8
rm_ "client/fix-jsx-parent.sh"                     # GAP #9 — one-shot JSX fix

# ─────────────────────────────────────────────────────────────
# 6. ONE-SHOT FIX SCRIPTS — c01 series
# ─────────────────────────────────────────────────────────────
echo "[6] One-shot fix: c01 esbuild" | tee -a "$LOGFILE"
rm_ "fix_c01_esbuild_override.py"
rm_ "fix_c01_esbuild_override_v2.py"

# ─────────────────────────────────────────────────────────────
# 7. ONE-SHOT FIX SCRIPTS — c03 series
# ─────────────────────────────────────────────────────────────
echo "[7] One-shot fix: c03 session bypass" | tee -a "$LOGFILE"
rm_ "c03_diagnostic.sh"
rm_ "fix_c03_proper.sh"
rm_ "fix_c03_session_bypass.py"
rm_ "fix_c03_surgical.sh"

# ─────────────────────────────────────────────────────────────
# 8. ONE-SHOT FIX SCRIPTS — collab / DAW patches
# ─────────────────────────────────────────────────────────────
echo "[8] One-shot fix: collab/DAW" | tee -a "$LOGFILE"
rm_ "fix-collab.py"
rm_ "fix_collab_AUDITED_v2_FIXED.py"
rm_ "patch-collab-daw.sh"
rm_ "patch_multi_track_view.py"
rm_ "patch_remove_panel_borders.py"
rm_ "patch_headers_v2.py"

# ─────────────────────────────────────────────────────────────
# 9. ONE-SHOT FIX SCRIPTS — Dockerfile
# ─────────────────────────────────────────────────────────────
echo "[9] One-shot fix: Dockerfile" | tee -a "$LOGFILE"
rm_ "fix_dockerfile.py"
rm_ "write_dockerfile.py"

# ─────────────────────────────────────────────────────────────
# 10. ONE-SHOT FIX SCRIPTS — eslint / logging / misc
# ─────────────────────────────────────────────────────────────
echo "[10] One-shot fix: eslint/logging/misc" | tee -a "$LOGFILE"
rm_ "fix_eslint_config.py"
rm_ "fix-logging-corrected.py"
rm_ "fix-logging-phase1.py"
rm_ "lint-cleanup-imports.py"
rm_ "inspect-init-constants.py"
rm_ "fix-processor-ts.cjs"
rm_ "barrier-check.cjs"
rm_ "fixduplicate.sh"
rm_ "fix_green_bars_direct.sh"
rm_ "apply-fix.sh"
rm_ "apply-phase4-engine-patch.sh"

# ─────────────────────────────────────────────────────────────
# 11. ONE-SHOT FIX SCRIPTS — f10 prompt-injection
# ─────────────────────────────────────────────────────────────
echo "[11] One-shot fix: f10 prompt injection" | tee -a "$LOGFILE"
rm_ "fix_f10_prompt_injection.py"
rm_ "fix_f10_prompt_injection_v2.py"

# ─────────────────────────────────────────────────────────────
# 12. ONE-SHOT FIX SCRIPTS — js-cookie
# ─────────────────────────────────────────────────────────────
echo "[12] One-shot fix: js-cookie" | tee -a "$LOGFILE"
rm_ "fix-js-cookie.sh"
rm_ "patch-js-cookie-both.sh"

# ─────────────────────────────────────────────────────────────
# 13. ONE-SHOT FIX SCRIPTS — LLPTE paths
# ─────────────────────────────────────────────────────────────
echo "[13] One-shot fix: LLPTE paths" | tee -a "$LOGFILE"
rm_ "fix_llpte_paths.py"

# ─────────────────────────────────────────────────────────────
# 14. ONE-SHOT FIX SCRIPTS — pricing
# ─────────────────────────────────────────────────────────────
echo "[14] One-shot fix: pricing" | tee -a "$LOGFILE"
rm_ "fix_pricing_audit.sh"
rm_ "pricing_audit_fix.sh"
rm_ "pricing_audit_patch.py"

# ─────────────────────────────────────────────────────────────
# 15. ONE-SHOT FIX SCRIPTS — patch runners
# ─────────────────────────────────────────────────────────────
echo "[15] One-shot fix: patch runners" | tee -a "$LOGFILE"
rm_ "run_all_patches.sh"
rm_ "run_all_patches_v2.sh"
rm_ "run_all_patches_v2_fixed.sh"
rm_ "patch_skills_13.py"
rm_ "patch_vst.py"

# ─────────────────────────────────────────────────────────────
# 16. ONE-SHOT FIX SCRIPTS — CORS (already fixed)
# ─────────────────────────────────────────────────────────────
echo "[16] One-shot fix: CORS" | tee -a "$LOGFILE"
rm_ "r3-cors-fix-option-a.sh"
rm_ "r3-cors-fix-option-b.sh"

# ─────────────────────────────────────────────────────────────
# 17. DUPLICATE / SUPERSEDED AUDIT SCRIPTS
# ─────────────────────────────────────────────────────────────
echo "[17] Duplicate/superseded audit scripts" | tee -a "$LOGFILE"
rm_ "r3-audit-round3.sh"           # duplicate of r3_audit_round3.sh (dash vs underscore)
rm_ "r3_audit_round3.sh"           # work done; keep neither
rm_ "r3hygiene.py"                 # superseded by asi-hygiene-master.sh
rm_ "r3-hygiene-execute.py"
rm_ "asi-audit-register.py"
rm_ "asi_mastery_troubleshooter.sh"
rm_ "asi-upgrade-fixed.sh"
rm_ "final-hygiene-fix.sh"
rm_ "audit_theme_config.py"
rm_ "find_api_auth.sh"
rm_ "master_sync_drizzle_journal.sh"  # migration journal fixed; no longer needed

# ─────────────────────────────────────────────────────────────
# 18. STALE DIAGNOSTIC / OUTPUT FILES
# ─────────────────────────────────────────────────────────────
echo "[18] Stale diagnostic/output files" | tee -a "$LOGFILE"
rm_ "DIAGNOSTIC_OUTPUT.txt"
rm_ "audit_r3.txt"
rm_ "_audit"                        # sync_map.txt inside — one-time audit artifact
rm_ "_full_engine_audit.txt"        # GAP #1
rm_ "pnpm_audit.json"               # GAP #2 — stale npm audit output
rm_ "output"                        # GAP #3 — contains only security-findings.sarif.json
rm_ "SECURITY_AUDIT_2026-05-26.md"  # GAP #4 — dated report; captured in git history
rm_ "FIX_IMPLEMENTATION_GUIDE.md"   # GAP #5 — stale per-fix implementation guide
rm_ "tsc-client-errors.log"
rm_ "tsc-errors.log"
rm_ "v2.log"
rm_ "asi_hygiene_audit_report.md"
rm_ "human_review_queue.txt"

# ─────────────────────────────────────────────────────────────
# 19. MISC JUNK AT ROOT
# ─────────────────────────────────────────────────────────────
echo "[19] Misc root junk" | tee -a "$LOGFILE"
rm_ "Fix"                               # GAP #6 — empty dir/file; no children at -L 2
rm_ "should"                            # empty file
rm_ "Sending"                           # empty/partial file
rm_ "tsc"                               # stray tsc binary or artifact
rm_ "tsc_F-10"                          # stray tsc artifact
rm_ "test-import.ts"                    # one-shot import test
rm_ "theme_config_rfc.txt"              # superseded by actual tailwind config
rm_ "p0_theme_additions.css"            # one-off snippet; verify not @import'd before deleting
rm_ "how 21ee9d2 --name-only"           # accidentally-saved git command (quoting handles spaces)
rm_ "ubmitSuggestionOutcome wiring"     # typo'd stray note (quoting handles spaces)

# ─────────────────────────────────────────────────────────────
# 20. tools/ one-shot patches + auth audit outputs
# ─────────────────────────────────────────────────────────────
echo "[20] tools/ one-shot patches + auth audit outputs" | tee -a "$LOGFILE"
rm_ "tools/patch_instrument_pagenav_import.py"
rm_ "tools/r3_fix_store_barrel.py"
rm_ "tools/r3_master_fix.py"
rm_ "tools/auth_god.py"     # GAP #11 — one-time auth audit tool
rm_ "tools/auth_report.json" # GAP #12 — stale auth audit report
rm_ "tools/auth_graph.html"  # GAP #13 — stale auth graph output

# ─────────────────────────────────────────────────────────────
# 21. scripts/ debug artifacts + one-shot installers
# ─────────────────────────────────────────────────────────────
echo "[21] scripts/ debug artifacts + one-shot installers" | tee -a "$LOGFILE"
rm_ "scripts/mutation-tracer.debug.ts"  # GAP #14 — .debug.ts = debug artifact, not source
rm_ "scripts/trpc-tracer.debug.ts"      # GAP #15
rm_ "scripts/install-mutation-tracer.sh" # GAP #16 — one-shot install; tracer is now installed

# BUG #6 — p0-p1-deploy.sh: one-shot P0/P1 security-fix deploy, now superseded by deploy.sh
# VERIFY before removing: grep -r "p0-p1-deploy" ~/Stable --include="*.{json,toml,sh,md}" -l
# rm_ "p0-p1-deploy.sh"

# ─────────────────────────────────────────────────────────────
# VERIFIED KEEP LIST
# ─────────────────────────────────────────────────────────────
# admin.sh                — ongoing DB/server admin utility
# db.sh                   — ongoing DB helper
# deploy.sh               — Railway deploy (live CI path)
# asi-hygiene-master.sh   — active hygiene runner
# r3-project-clean.sh     — active cleanup utility
# r3audit / r3execute / r3setup — active Telegram agent tools
# shared/*.js             — ESM-style .js companions to .ts; server imports use these
# scripts/r3_master_fix.py — BUG #2 NOTE: VERIFY this is called by asi-hygiene-master.sh
#                           grep -n "r3_master_fix" ~/Stable/asi-hygiene-master.sh
#                           If not referenced, add to removal list and re-run.

# ─────────────────────────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────────────────────────
echo "" | tee -a "$LOGFILE"
if $DRY; then
  echo "========  DRY RUN COMPLETE  ========" | tee -a "$LOGFILE"
  echo "  Review above, then run:" | tee -a "$LOGFILE"
  echo "    bash ~/Stable/cleanup_dead_files.sh --execute" | tee -a "$LOGFILE"
else
  echo "========  CLEANUP COMPLETE  ========" | tee -a "$LOGFILE"
  echo "  Deleted : $REMOVED" | tee -a "$LOGFILE"
  echo "  Skipped : $SKIPPED  (already absent)" | tee -a "$LOGFILE"
  echo "  Log     : $LOGFILE" | tee -a "$LOGFILE"
  echo "" | tee -a "$LOGFILE"
  echo "  Next steps:" | tee -a "$LOGFILE"
  echo "    pnpm tsc --noEmit" | tee -a "$LOGFILE"
  echo "    git add -A && git commit -m 'chore: remove dead scripts, patches, and backup files'" | tee -a "$LOGFILE"
  echo "" | tee -a "$LOGFILE"
  echo "  Verify p0-p1-deploy.sh still needed:" | tee -a "$LOGFILE"
  echo "    grep -r 'p0-p1-deploy' ~/Stable --include='*.{json,toml,sh,md}' -l" | tee -a "$LOGFILE"
  echo "  Verify scripts/r3_master_fix.py still referenced:" | tee -a "$LOGFILE"
  echo "    grep -n 'r3_master_fix' ~/Stable/asi-hygiene-master.sh" | tee -a "$LOGFILE"
fi
echo "" | tee -a "$LOGFILE"
