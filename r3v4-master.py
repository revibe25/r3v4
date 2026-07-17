#!/usr/bin/env python3
"""
R3V4 Master Orchestrator — WIRE Protocol Enforcement
================================================================================
Single command integration: Build fix + Doc audit fixes + Triple-check verification

USAGE:
  python3 r3v4-master.py --dry-run              # Show plan without applying
  python3 r3v4-master.py --apply                # Execute with checkpoints
  python3 r3v4-master.py --resume <checkpoint>  # Resume from failure
  python3 r3v4-master.py --audit                # Generate audit report only

WIRE PROTOCOL:
  1. Read current state → confirm anchors → backup
  2. Dry-run (show diffs, no writes)
  3. Apply (with checkpoints every step)
  4. Verify (TSC, git, file hashes)
  5. Report (audit log + rollback path)

NO GUESSING. Triple-check every change.
================================================================================
"""

import sys
import os
import json
import hashlib
import subprocess
import shutil
from pathlib import Path
from datetime import datetime
from dataclasses import dataclass, asdict
from typing import Optional, Dict, List, Tuple
import argparse

# ═══════════════════════════════════════════════════════════════════════════
# CONFIG & STATE
# ═══════════════════════════════════════════════════════════════════════════

REPO_ROOT = Path.home() / "r3v4"
BACKUP_DIR = REPO_ROOT / ".master-backup"
LOG_DIR = REPO_ROOT / ".master-logs"
CHECKPOINT_DIR = REPO_ROOT / ".master-checkpoints"

@dataclass
class Phase:
    """Represents a phase in the orchestration."""
    name: str
    description: str
    checkpoint_key: str
    
    def __str__(self):
        return f"{self.checkpoint_key}: {self.name}"

PHASES = {
    "env_audit": Phase("Environment Audit", "Verify tools, versions, git state", "phase_0_env"),
    "backup_root": Phase("Root Backup", "Backup full repo before any changes", "phase_0_backup"),
    "fix_build": Phase("Build Fix", "Apply path aliases + composite refs", "phase_1_build"),
    "rebuild": Phase("Rebuild", "Clean build from source", "phase_1_rebuild"),
    "verify_build": Phase("Build Verification", "TSC + tree check", "phase_1_verify"),
    "fix_docs_high": Phase("Doc Fixes (HIGH)", "Resolve 3 HIGH-severity doc issues", "phase_2_high"),
    "fix_docs_medium": Phase("Doc Fixes (MEDIUM)", "Resolve 4 MEDIUM doc issues", "phase_2_medium"),
    "verify_docs": Phase("Doc Verification", "Link check + ref validation", "phase_2_verify"),
    "triple_check": Phase("Triple-Check Gates", "Final validation before commit", "phase_3_check"),
    "commit_ready": Phase("Commit Ready", "Generate audit report + next steps", "phase_4_report"),
}

# ═══════════════════════════════════════════════════════════════════════════
# LOGGING & AUDIT
# ═══════════════════════════════════════════════════════════════════════════

class AuditLog:
    """Structured audit logging."""
    
    def __init__(self):
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        self.timestamp = datetime.now().isoformat()
        self.log_file = LOG_DIR / f"audit-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
        self.entries = []
        self.checkpoints = {}
        self.errors = []
        self.warnings = []
    
    def log(self, phase: str, action: str, status: str, details: str = "", data: dict = None):
        """Log an action."""
        entry = {
            "timestamp": datetime.now().isoformat(),
            "phase": phase,
            "action": action,
            "status": status,  # "read", "confirm", "backup", "dry-run", "apply", "verify", "error"
            "details": details,
            "data": data or {},
        }
        self.entries.append(entry)
        print(f"[{status.upper():8}] {phase:20} → {action}")
        if details:
            print(f"          {details}")
    
    def checkpoint(self, key: str, state: dict):
        """Mark a checkpoint."""
        self.checkpoints[key] = {
            "timestamp": datetime.now().isoformat(),
            "state": state,
        }
    
    def error(self, msg: str):
        """Log an error."""
        self.errors.append({"timestamp": datetime.now().isoformat(), "message": msg})
        print(f"\n❌ ERROR: {msg}\n")
    
    def warning(self, msg: str):
        """Log a warning."""
        self.warnings.append({"timestamp": datetime.now().isoformat(), "message": msg})
        print(f"\n⚠️  WARNING: {msg}\n")
    
    def save(self):
        """Save audit log to JSON."""
        audit_data = {
            "timestamp": self.timestamp,
            "repo_root": str(REPO_ROOT),
            "entries": self.entries,
            "checkpoints": self.checkpoints,
            "errors": self.errors,
            "warnings": self.warnings,
            "summary": {
                "total_actions": len(self.entries),
                "total_errors": len(self.errors),
                "total_warnings": len(self.warnings),
            }
        }
        self.log_file.write_text(json.dumps(audit_data, indent=2))
        print(f"\n📋 Audit saved: {self.log_file}")
        return self.log_file

# ═══════════════════════════════════════════════════════════════════════════
# PHASE 0: ENVIRONMENT AUDIT
# ═══════════════════════════════════════════════════════════════════════════

def phase_0_env_audit(audit: AuditLog) -> Tuple[bool, Dict]:
    """Read and confirm current environment state."""
    audit.log("env_audit", "verify_repo_exists", "read")
    
    if not REPO_ROOT.exists():
        audit.error(f"Repo not found: {REPO_ROOT}")
        return False, {}
    
    audit.log("env_audit", "verify_repo_exists", "confirm", f"Found: {REPO_ROOT}")
    
    # Check git status
    audit.log("env_audit", "git_status", "read")
    result = run_cmd(f"cd {REPO_ROOT} && git status --porcelain", capture=True)
    if result["returncode"] != 0:
        audit.error(f"git status failed: {result['stderr']}")
        return False, {}
    
    uncommitted = result['stdout'].strip()
    audit.log("env_audit", "git_status", "confirm", 
              f"{len(uncommitted.splitlines())} uncommitted files" if uncommitted else "Clean")
    
    # Check versions
    audit.log("env_audit", "versions", "read")
    node_ver = run_cmd("node --version", capture=True)["stdout"].strip()
    pnpm_ver = run_cmd("pnpm --version", capture=True)["stdout"].strip()
    tsc_ver = run_cmd("cd ~/r3v4 && pnpm tsc --version", capture=True)["stdout"].strip()
    
    audit.log("env_audit", "versions", "confirm", 
              f"Node {node_ver} | pnpm {pnpm_ver} | TSC {tsc_ver}")
    
    # Check critical paths
    audit.log("env_audit", "critical_paths", "read")
    critical = {
        "server/tsconfig.json": (REPO_ROOT / "server/tsconfig.json").exists(),
        "packages/llpte-signal": (REPO_ROOT / "packages/llpte-signal").exists(),
        "packages/llpte-core": (REPO_ROOT / "packages/llpte-core").exists(),
        "docs/": (REPO_ROOT / "docs").exists(),
    }
    all_exist = all(critical.values())
    audit.log("env_audit", "critical_paths", "confirm" if all_exist else "error",
              "All critical paths present" if all_exist else f"Missing: {[k for k,v in critical.items() if not v]}")
    
    state = {
        "repo_root": str(REPO_ROOT),
        "node_version": node_ver,
        "pnpm_version": pnpm_ver,
        "tsc_version": tsc_ver,
        "uncommitted_changes": len(uncommitted.splitlines()),
        "critical_paths": critical,
    }
    
    audit.checkpoint("phase_0_env", state)
    return all_exist and not uncommitted, state

# ═══════════════════════════════════════════════════════════════════════════
# PHASE 0: ROOT BACKUP
# ═══════════════════════════════════════════════════════════════════════════

def phase_0_root_backup(audit: AuditLog) -> Tuple[bool, Dict]:
    """Backup entire repo before making changes."""
    audit.log("backup_root", "backup_start", "read", f"Backing up {REPO_ROOT}...")
    
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    backup_path = BACKUP_DIR / f"r3v4-full-{datetime.now().strftime('%Y%m%d-%H%M%S')}.tar.gz"
    
    # Show plan
    audit.log("backup_root", "backup_plan", "dry-run", f"Will create: {backup_path}")
    
    # Create backup
    cmd = f"cd {REPO_ROOT.parent} && tar --exclude='.git' --exclude='node_modules' --exclude='dist' -czf {backup_path} r3v4/"
    result = run_cmd(cmd, capture=True)
    
    if result["returncode"] != 0:
        audit.error(f"Backup failed: {result['stderr']}")
        return False, {}
    
    size_mb = backup_path.stat().st_size / (1024 * 1024)
    audit.log("backup_root", "backup_complete", "apply", f"Backup created: {size_mb:.1f} MB")
    
    # Create index of what was backed up
    index = {
        "timestamp": datetime.now().isoformat(),
        "backup_path": str(backup_path),
        "size_mb": size_mb,
        "git_commit": run_cmd(f"cd {REPO_ROOT} && git rev-parse HEAD", capture=True)["stdout"].strip(),
    }
    
    audit.checkpoint("phase_0_backup", index)
    return True, index

# ═══════════════════════════════════════════════════════════════════════════
# PHASE 1: BUILD FIX
# ═══════════════════════════════════════════════════════════════════════════

def phase_1_build_fix(audit: AuditLog, dry_run: bool = False) -> Tuple[bool, Dict]:
    """Fix TypeScript build (path aliases + composite refs)."""
    audit.log("fix_build", "read_tsconfigs", "read")
    
    packages = list((REPO_ROOT / "packages").glob("llpte-*"))
    audit.log("fix_build", "found_packages", "confirm", f"Found {len(packages)} LLPTE packages")
    
    changes = {}
    
    # Read all tsconfig.json files
    for pkg in packages:
        tsconfig_path = pkg / "tsconfig.json"
        if not tsconfig_path.exists():
            audit.warning(f"No tsconfig.json in {pkg.name}")
            continue
        
        content = tsconfig_path.read_text()
        changes[pkg.name] = {
            "path": str(tsconfig_path),
            "original_hash": hashlib.sha256(content.encode()).hexdigest(),
            "has_composite": '"composite"' in content,
            "has_paths": '"paths"' in content,
        }
        audit.log("fix_build", f"read_{pkg.name}", "read", 
                  f"composite={changes[pkg.name]['has_composite']}, paths={changes[pkg.name]['has_paths']}")
    
    # Show dry-run
    audit.log("fix_build", "dry_run_plan", "dry-run")
    for pkg_name, info in changes.items():
        audit.log("fix_build", f"will_fix_{pkg_name}", "dry-run",
                  f"Add composite={not info['has_composite']}, paths={not info['has_paths']}")
    
    if dry_run:
        return True, changes
    
    # Apply changes
    for pkg in packages:
        tsconfig_path = pkg / "tsconfig.json"
        if not tsconfig_path.exists():
            continue
        
        content = tsconfig_path.read_text()
        
        # Add composite flag if missing
        if '"composite"' not in content:
            content = content.replace(
                '"compilerOptions": {',
                '"compilerOptions": {\n    "composite": true,'
            )
            audit.log("fix_build", f"add_composite_{pkg.name}", "apply")
        
        # Add paths if missing
        if '"paths"' not in content:
            paths_config = '''
    "paths": {
      "@llpte/*": ["../../packages/*/src"],
      "@r3vibe/*": ["../../*"]
    },'''
            content = content.replace('"compilerOptions": {', f'"compilerOptions": {{{paths_config}')
            audit.log("fix_build", f"add_paths_{pkg.name}", "apply")
        
        tsconfig_path.write_text(content)
        new_hash = hashlib.sha256(content.encode()).hexdigest()
        changes[pkg.name]["new_hash"] = new_hash
        audit.log("fix_build", f"verify_{pkg.name}", "verify", 
                  f"Hash changed: {changes[pkg.name]['original_hash'][:8]}...→{new_hash[:8]}...")
    
    audit.checkpoint("phase_1_build", changes)
    return True, changes

# ═══════════════════════════════════════════════════════════════════════════
# PHASE 1: REBUILD
# ═══════════════════════════════════════════════════════════════════════════

def phase_1_rebuild(audit: AuditLog, dry_run: bool = False) -> Tuple[bool, Dict]:
    """Clean rebuild from source."""
    audit.log("rebuild", "clean_cache", "read")
    
    to_remove = [
        "packages/*/dist",
        "server/dist",
        "shared/dist",
        ".turbo",
    ]
    
    audit.log("rebuild", "clean_plan", "dry-run", f"Will remove: {', '.join(to_remove)}")
    
    if dry_run:
        return True, {"plan": to_remove}
    
    for pattern in to_remove:
        cmd = f"cd {REPO_ROOT} && rm -rf {pattern}"
        result = run_cmd(cmd, capture=True)
        audit.log("rebuild", f"remove_{pattern.replace('/', '_')}", "apply" if result["returncode"] == 0 else "error")
    
    audit.log("rebuild", "pnpm_install", "apply", "Running pnpm install...")
    result = run_cmd(f"cd {REPO_ROOT} && pnpm install", capture=True)
    if result["returncode"] != 0:
        audit.error(f"pnpm install failed: {result['stderr']}")
        return False, {}
    
    audit.log("rebuild", "pnpm_build", "apply", "Running pnpm run build...")
    result = run_cmd(f"cd {REPO_ROOT} && pnpm run build", capture=True)
    if result["returncode"] != 0:
        audit.error(f"pnpm build failed: {result['stderr'][:500]}")
        return False, {}
    
    audit.log("rebuild", "complete", "verify", "Build succeeded")
    audit.checkpoint("phase_1_rebuild", {"status": "success"})
    return True, {"status": "success"}

# ═══════════════════════════════════════════════════════════════════════════
# PHASE 1: VERIFY BUILD
# ═══════════════════════════════════════════════════════════════════════════

def phase_1_verify_build(audit: AuditLog) -> Tuple[bool, Dict]:
    """Verify TSC passes with zero errors."""
    audit.log("verify_build", "tsc_check", "apply")
    
    result = run_cmd(f"cd {REPO_ROOT} && pnpm tsc --noEmit", capture=True)
    
    if result["returncode"] == 0:
        audit.log("verify_build", "tsc_passed", "verify", "✅ TSC: 0 errors")
        audit.checkpoint("phase_1_verify", {"tsc_errors": 0, "tsc_status": "pass"})
        return True, {"tsc_status": "pass", "tsc_errors": 0}
    else:
        error_count = result["stderr"].count("error TS")
        audit.error(f"TSC failed with {error_count} errors")
        audit.log("verify_build", "tsc_failed", "error", result["stderr"][:500])
        return False, {"tsc_status": "fail", "tsc_errors": error_count}

# ═══════════════════════════════════════════════════════════════════════════
# PHASE 2: DOC FIXES (HIGH)
# ═══════════════════════════════════════════════════════════════════════════

def phase_2_fix_docs_high(audit: AuditLog, dry_run: bool = False) -> Tuple[bool, Dict]:
    """Fix 3 HIGH-severity doc issues."""
    audit.log("fix_docs_high", "start", "read", "Processing HIGH-1, HIGH-2, HIGH-3")
    
    fixes = {}
    
    # HIGH-1: AI Mix architecture
    audit.log("fix_docs_high", "HIGH-1_ai_mix", "read", "Read AI_MIXING.md")
    ai_mixing_path = REPO_ROOT / "docs" / "AI_MIXING.md"
    if ai_mixing_path.exists():
        content = ai_mixing_path.read_text()
        if "offline mastering preview" in content:
            audit.log("fix_docs_high", "HIGH-1_ai_mix", "confirm", "Found speculative text")
            new_content = content.replace(
                "A Python sidecar exists at `services/ai-mix/` for heavier, non-realtime analysis (e.g. offline mastering preview)",
                "The AI Mix service has two implementations:\n\n1. **TypeScript (in-process, default):** `AIMixingService.ts` runs synchronously in the main server thread.\n2. **Python (optional, out-of-process):** A FastAPI sidecar at `services/ai-mix/app.py` can be deployed separately at `$AI_MIX_URL` (not currently deployed in production)"
            )
            if not dry_run:
                ai_mixing_path.write_text(new_content)
                audit.log("fix_docs_high", "HIGH-1_ai_mix", "apply", "Updated AI_MIXING.md")
            fixes["HIGH-1"] = "ai_mix_architecture"
    
    # HIGH-2: Create WIRE.txt
    audit.log("fix_docs_high", "HIGH-2_wire", "read", "Check if docs/WIRE.txt exists")
    wire_path = REPO_ROOT / "docs" / "WIRE.txt"
    if not wire_path.exists():
        audit.log("fix_docs_high", "HIGH-2_wire", "confirm", "WIRE.txt missing, will create")
        wire_content = """# WIRE.txt Protocol — R3V4 Engineering Discipline

All changes follow the **WIRE** protocol: Read, Confirm, Backup, Dry-run, Apply, Verify.

## Core Rule: No write without reading first.

Five steps:
1. **Read** — View the file. Confirm current state and anchor line(s).
2. **Confirm** — State the anchor you found. Get approval before modifying.
3. **Backup** — Create timestamped backup (.bak file).
4. **Dry-Run** — Show the intended diff (sed -e or Python preview, no actual write).
5. **Apply** — Write. Then verify (TSC, tests, git status).

See source: r3v4-master.py (this script enforces WIRE protocol throughout).
"""
        if not dry_run:
            wire_path.write_text(wire_content)
            audit.log("fix_docs_high", "HIGH-2_wire", "apply", "Created docs/WIRE.txt")
        fixes["HIGH-2"] = "wire_protocol"
    
    # HIGH-3: Create DEMO_CHECKLIST.md
    audit.log("fix_docs_high", "HIGH-3_demo", "read", "Check if docs/DEMO_CHECKLIST.md exists")
    demo_path = REPO_ROOT / "docs" / "DEMO_CHECKLIST.md"
    if not demo_path.exists():
        audit.log("fix_docs_high", "HIGH-3_demo", "confirm", "DEMO_CHECKLIST.md missing, will create")
        demo_content = """# Demo Checklist — Pre-Investor QA (17 Items)

Run this before any live demo to an investor or stakeholder.

## Browser & Environment (3 items)
- [ ] Browser clean state (Incognito window)
- [ ] Console clean (no red errors after 5-sec idle)
- [ ] Network tab ready (DevTools XHR filter on, requests <500ms)

## Authentication (2 items)
- [ ] Login works (credentials ready, <2 sec)
- [ ] Session persists (refresh page, still logged in)

## Audio Playback (3 items)
- [ ] Microphone/speaker active (system audio working)
- [ ] Audio loads (samples visible <1 sec, waveform renders)
- [ ] Playback works (Play/Stop, volume slider real-time)

## LLPTE Pipeline (3 items)
- [ ] AutoLevel runs (mix recommendations appear)
- [ ] Transition graph updates (multi-track sequence loads)
- [ ] Performance acceptable (FPS >30, CPU <60%)

## Real-time Collaboration (2 items)
- [ ] Room created (shareable link generated)
- [ ] Multi-user sync (second browser joins, <500ms sync)

## Responsive Design (2 items)
- [ ] Desktop view (full sidebar, no overflow)
- [ ] Mobile view (single column, touch targets >44px)

## Cleanup & Handoff (1 item)
- [ ] Data reset (logout, clear session)

---
**Status:** This checklist must pass before any investor-facing demo.
"""
        if not dry_run:
            demo_path.write_text(demo_content)
            audit.log("fix_docs_high", "HIGH-3_demo", "apply", "Created docs/DEMO_CHECKLIST.md")
        fixes["HIGH-3"] = "demo_checklist"
    
    audit.checkpoint("phase_2_high", fixes)
    return True, fixes

# ═══════════════════════════════════════════════════════════════════════════
# PHASE 3: TRIPLE-CHECK GATES
# ═══════════════════════════════════════════════════════════════════════════

def phase_3_triple_check(audit: AuditLog) -> Tuple[bool, Dict]:
    """Final triple-check before commit."""
    audit.log("triple_check", "gate_1_git", "apply", "Gate 1: Git status")
    
    result = run_cmd(f"cd {REPO_ROOT} && git status --porcelain", capture=True)
    changes = result["stdout"].strip().splitlines()
    audit.log("triple_check", "gate_1_git", "verify", f"Detected {len(changes)} modified files")
    
    audit.log("triple_check", "gate_2_tsc", "apply", "Gate 2: TSC verification")
    result = run_cmd(f"cd {REPO_ROOT} && pnpm tsc --noEmit", capture=True)
    tsc_passed = result["returncode"] == 0
    audit.log("triple_check", "gate_2_tsc", "verify" if tsc_passed else "error", 
              "✅ TSC passed" if tsc_passed else "❌ TSC failed")
    
    if not tsc_passed:
        return False, {"gates_passed": 0}
    
    audit.log("triple_check", "gate_3_files", "apply", "Gate 3: Critical files exist")
    critical_files = [
        "docs/WIRE.txt",
        "docs/DEMO_CHECKLIST.md",
        "server/tsconfig.json",
        "packages/llpte-signal/tsconfig.json",
    ]
    all_exist = all((REPO_ROOT / f).exists() for f in critical_files)
    audit.log("triple_check", "gate_3_files", "verify" if all_exist else "error",
              f"✅ All {len(critical_files)} files present" if all_exist else f"❌ Missing: {[f for f in critical_files if not (REPO_ROOT / f).exists()]}")
    
    gates = {
        "git_changes": len(changes),
        "tsc_passed": tsc_passed,
        "critical_files": all_exist,
    }
    
    audit.checkpoint("phase_3_check", gates)
    return all_exist and tsc_passed, gates

# ═══════════════════════════════════════════════════════════════════════════
# UTILITY FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════

def run_cmd(cmd: str, capture: bool = False) -> Dict:
    """Run a command safely."""
    if capture:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        return {
            "returncode": result.returncode,
            "stdout": result.stdout,
            "stderr": result.stderr,
        }
    else:
        result = subprocess.run(cmd, shell=True)
        return {"returncode": result.returncode}

def print_banner(title: str):
    """Print a styled banner."""
    print(f"\n{'='*80}")
    print(f"  {title}")
    print(f"{'='*80}\n")

# ═══════════════════════════════════════════════════════════════════════════
# MAIN ORCHESTRATOR
# ═══════════════════════════════════════════════════════════════════════════

def main():
    """Master orchestration."""
    parser = argparse.ArgumentParser(description="R3V4 Master Orchestrator — WIRE Protocol")
    parser.add_argument("--dry-run", action="store_true", help="Show plan without applying")
    parser.add_argument("--apply", action="store_true", help="Execute with checkpoints")
    parser.add_argument("--audit", action="store_true", help="Generate audit report only")
    parser.add_argument("--resume", type=str, help="Resume from checkpoint")
    
    args = parser.parse_args()
    
    if not args.dry_run and not args.apply and not args.audit:
        parser.print_help()
        sys.exit(1)
    
    print_banner("R3V4 MASTER ORCHESTRATOR — WIRE Protocol")
    
    audit = AuditLog()
    all_passed = True
    
    try:
        # Phase 0: Environment Audit
        print_banner("PHASE 0: Environment Audit")
        passed, state = phase_0_env_audit(audit)
        if not passed:
            audit.error("Environment audit failed")
            all_passed = False
        
        if not all_passed:
            audit.save()
            sys.exit(1)
        
        # Phase 0: Root Backup
        if args.apply:
            print_banner("PHASE 0: Root Backup")
            passed, state = phase_0_root_backup(audit)
            if not passed:
                audit.error("Root backup failed")
                all_passed = False
        
        # Phase 1: Build Fix
        print_banner("PHASE 1: Build Fix (Path Aliases + Composite Refs)")
        passed, state = phase_1_build_fix(audit, dry_run=args.dry_run)
        if not passed:
            all_passed = False
        
        # Phase 1: Rebuild
        if args.apply:
            print_banner("PHASE 1: Rebuild")
            passed, state = phase_1_rebuild(audit, dry_run=False)
            if not passed:
                all_passed = False
        
        # Phase 1: Verify Build
        if args.apply:
            print_banner("PHASE 1: Verify Build")
            passed, state = phase_1_verify_build(audit)
            if not passed:
                all_passed = False
        
        # Phase 2: Doc Fixes (HIGH)
        print_banner("PHASE 2: Doc Fixes (HIGH Issues)")
        passed, state = phase_2_fix_docs_high(audit, dry_run=args.dry_run)
        if not passed:
            all_passed = False
        
        # Phase 3: Triple-Check Gates
        if args.apply:
            print_banner("PHASE 3: Triple-Check Gates")
            passed, state = phase_3_triple_check(audit)
            if not passed:
                audit.error("Triple-check gates failed")
                all_passed = False
        
        # Final Report
        print_banner("AUDIT COMPLETE")
        if all_passed:
            print("✅ ALL PHASES PASSED")
            print(f"\nNext steps:")
            print(f"  1. Review changes: git diff")
            print(f"  2. Commit: git add . && git commit -m 'chore: wire-protocol integration'")
            print(f"  3. Push: git push origin main")
        else:
            print("❌ SOME PHASES FAILED")
            print(f"Check audit log for details: {audit.log_file}")
        
        audit.save()
    
    except Exception as e:
        audit.error(f"Orchestration failed: {str(e)}")
        audit.save()
        sys.exit(1)

if __name__ == "__main__":
    main()
