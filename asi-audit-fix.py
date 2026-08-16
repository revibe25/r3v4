#!/usr/bin/env python3
"""ASI Audit Automation - Full Stack v3"""
import argparse, os, re, shutil, sys
from pathlib import Path
from datetime import datetime

R, G, Y, B, C, N = "\033[0;31m", "\033[0;32m", "\033[1;33m", "\033[0;34m", "\033[0;36m", "\033[0m"
BOLD = "\033[1m"

def info(s):  print(f"{B}ℹ{N}  {s}")
def ok(s):    print(f"{G}✔{N}  {s}")
def warn(s):  print(f"{Y}⚠{N}  {s}")
def err(s):   print(f"{R}✖{N}  {s}")
def head(s):  print(f"{BOLD}{C}▶ {s}{N}")

SKIP_DIRS = {"node_modules", ".git", "dist", "build", "out", ".next", ".turbo", "coverage"}

def should_skip_dir(path: Path) -> bool:
    return any(part in SKIP_DIRS for part in path.parts)

def backup(path: Path, backup_dir: Path, dry: bool):
    if dry:
        info(f"[DRY-RUN] Would backup: {path.name}")
        return
    backup_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, backup_dir / f"{path.name}.bak")

def save_latest(backup_dir: Path, latest: Path, dry: bool):
    if dry or not backup_dir.exists():
        return
    latest.unlink(missing_ok=True)
    latest.symlink_to(backup_dir, target_is_directory=True)

def is_valid_ts_start(line: str) -> bool:
    return bool(re.match(r'^\s*(import|export|const|let|var|function|interface|type|declare|//|/\*|\*|class|"use strict"|`|\'|<)', line))

def do_restore(project: Path, backup_root: Path):
    head("RESTORE MODE")
    latest = backup_root / "latest"
    if not latest.exists() or not latest.is_symlink():
        err("No backup symlink found")
        info(f"Look in {backup_root} for manual restoration")
        sys.exit(1)
    src_dir = latest.resolve()
    info(f"Restoring from: {src_dir}")
    for bak in src_dir.glob("*.bak"):
        fname = bak.stem
        orig = None
        if fname == "instrument.tsx":
            orig = project / "client/src/pages/instrument.tsx"
        elif fname == "audio.ts":
            orig = project / "client/src/lib/audio.ts"
        elif fname.startswith("vite.config."):
            cands = list((project / "client").glob("vite.config.*"))
            orig = cands[0] if cands else None
        else:
            for f in (project / "server").rglob("*"):
                if f.is_file() and f.name == fname and not should_skip_dir(f):
                    orig = f
                    break
        if orig and orig.exists():
            shutil.copy2(bak, orig)
            ok(f"Restored: {orig}")
        else:
            warn(f"Could not locate original for: {fname}")
    ok("Rollback complete")

def fix_instrument(project: Path, backup_dir: Path, dry: bool):
    head("FIX 1: client/src/pages/instrument.tsx")
    inst = project / "client/src/pages/instrument.tsx"
    if not inst.exists():
        warn("File not found")
        return
    content = inst.read_text(encoding="utf-8")
    lines = content.splitlines()
    first = next((l for l in lines if l.strip()), "")
    if not is_valid_ts_start(first):
        warn("Detected prose injection on line 1")
        info(f"First line: {first[:75]!r}")
        backup(inst, backup_dir, dry)
        if not dry:
            if re.search(r'^```(tsx|typescript|jsx)\s*$', content, re.M):
                info("Markdown fences detected. Extracting...")
                new_lines, in_block = [], False
                for line in lines:
                    if re.match(r'^```(tsx|typescript|jsx)\s*$', line):
                        in_block = True; continue
                    if re.match(r'^```\s*$', line):
                        in_block = False; continue
                    if in_block:
                        new_lines.append(line)
                if new_lines:
                    inst.write_text(chr(10).join(new_lines) + chr(10), encoding="utf-8")
                    ok("Extracted from markdown fences")
                else:
                    inst.write_text(chr(10).join(lines[1:]) + chr(10), encoding="utf-8")
                    ok("Removed first line")
            else:
                inst.write_text(chr(10).join(lines[1:]) + chr(10), encoding="utf-8")
                ok("Removed prose preamble")
            content = inst.read_text(encoding="utf-8")
    else:
        ok("No prose injection")
    tone_mod = re.search(r'^(const|let|var)\s+\w+\s*=\s*new\s+Tone\.(Synth|PolySynth|AMSynth|FMSynth|MembraneSynth|MetalSynth|PluckSynth|Sampler|Player|Loop|Sequence|Part)', content, re.M)
    if tone_mod:
        warn("Module-level Tone.js instantiation detected")
        info(f"  -> {tone_mod.group(0)[:75]}")
        warn("MANUAL FIX: Move inside useEffect")
    else:
        ok("No module-level Tone.js instantiation")

def fix_audio_ts(project: Path, backup_dir: Path, dry: bool):
    head("FIX 2: client/src/lib/audio.ts")
    audio = project / "client/src/lib/audio.ts"
    if not audio.exists():
        warn("audio.ts not found")
        return
    content = audio.read_text(encoding="utf-8")
    if re.search(r"import\s+Tone\s+from\s+['\"]tone['\"]", content):
        warn("Default import detected - breaks in Vite")
        backup(audio, backup_dir, dry)
        if not dry:
            new_content = re.sub(r"import\s+Tone\s+from\s+['\"]tone['\"]", 'import * as Tone from "tone"', content)
            audio.write_text(new_content, encoding="utf-8")
            ok("Changed to namespace import")
    else:
        ok("Import looks correct")

def fix_vite_config(project: Path, backup_dir: Path, dry: bool):
    head("FIX 3: Vite Config")
    vite_cfgs = list((project / "client").glob("vite.config.*"))
    if not vite_cfgs:
        warn("No vite.config.* found")
        return
    cfg = vite_cfgs[0]
    info(f"Found: {cfg.name}")
    text = cfg.read_text(encoding="utf-8")
    if "esbuildOptions" not in text:
        ok("Already clean")
        return
    warn(f"Deprecated esbuildOptions in {cfg.name}")
    backup(cfg, backup_dir, dry)
    if not dry:
        new_text = text.replace("esbuildOptions", "/* [ASI-AUDIT] Migrated */" + chr(10) + "    rolldownOptions", 1)
        cfg.write_text(new_text, encoding="utf-8")
        ok("Renamed to rolldownOptions")

def fix_aimix_router(project: Path, backup_dir: Path, dry: bool):
    head("FIX 4: Server - aiMix.router.ts")
    matches = []
    for f in (project / "server").rglob("*"):
        if not f.is_file() or f.suffix not in (".ts", ".js", ".mjs"):
            continue
        if should_skip_dir(f):
            continue
        txt = f.read_text(encoding="utf-8")
        if re.search(r'import.*aiMix\.router|require.*aiMix\.router', txt):
            matches.append(f)
    if not matches:
        ok("Already clean")
        return
    for f in matches:
        warn(f"Found in: {f.name}")
        backup(f, backup_dir, dry)
        if dry:
            continue
        lines = f.read_text(encoding="utf-8").splitlines()
        new_lines = []
        for line in lines:
            if re.search(r'aiMix\.router', line) and not line.strip().startswith("//"):
                new_lines.append("// [ASI-AUDIT] Deprecated - use daw.ai.suggestions instead.")
                new_lines.append(f"// {line}")
            else:
                new_lines.append(line)
        f.write_text(chr(10).join(new_lines) + chr(10), encoding="utf-8")
        ok(f"Commented out in {f.name}")

def validate(project: Path):
    head("VALIDATION")
    inst = project / "client/src/pages/instrument.tsx"
    if inst.exists():
        content = inst.read_text(encoding="utf-8")
        first = next((l for l in content.splitlines() if l.strip()), "")
        if is_valid_ts_start(first):
            ok("instrument.tsx syntax OK")
        else:
            warn("instrument.tsx needs review")
    audio = project / "client/src/lib/audio.ts"
    if audio.exists():
        content = audio.read_text(encoding="utf-8")
        if 'import * as Tone from "tone"' in content or "import * as Tone from 'tone'" in content:
            ok("audio.ts namespace import OK")
        else:
            warn("audio.ts import may be wrong")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("project_root", nargs="?", default=os.getcwd())
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--restore", action="store_true")
    args = parser.parse_args()
    project = Path(args.project_root).resolve()
    backup_root = project / ".asi-audit-backups"
    if args.restore:
        return do_restore(project, backup_root)
    print(f"{BOLD}ASI Audit Automation{N}  |  Mode: {'DRY-RUN' if args.dry_run else 'LIVE'}")
    print(f"Project: {project}")
    print("-" * 40)
    if not (project / "client").is_dir() or not (project / "server").is_dir():
        err("Expected client/ and server/ directories")
        sys.exit(1)
    backup_dir = backup_root / datetime.now().strftime("%Y%m%d_%H%M%S")
    fix_instrument(project, backup_dir, args.dry_run)
    fix_audio_ts(project, backup_dir, args.dry_run)
    fix_vite_config(project, backup_dir, args.dry_run)
    fix_aimix_router(project, backup_dir, args.dry_run)
    save_latest(backup_dir, backup_root / "latest", args.dry_run)
    validate(project)
    print(f"{BOLD}{G}Audit Complete{N}")
    if not args.dry_run:
        print(f"Backups: {backup_dir}")
        print(f"Rollback: python3 {sys.argv[0]} --restore")
    print(f"Preview: python3 {sys.argv[0]} --dry-run")

if __name__ == "__main__":
    main()
