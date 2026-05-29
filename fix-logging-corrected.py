#!/usr/bin/env python3
import os, re, sys, subprocess, json
from pathlib import Path
from datetime import datetime
from typing import Tuple, List, Optional

PROJECT_ROOT = Path(os.getcwd())
LOGGER_IMPORT = 'import { logger } from "../utils/logger";'

FIXES = [
    ("server/db/index.ts", r"console\.error\(\s*'\[db\]\s+Unexpected pool error:',\s*err\.message\s*\);", "logger.error('Unexpected pool error', { message: err.message });", "logger"),
    ("server/routes.ts", r"\.catch\(console\.error\);", ".catch((err) => logger.error('Failed to unlink uploaded file', { error: err instanceof Error ? err.message : String(err) }));", "logger"),
    ("server/routes/mock-billing.ts", r"console\.error\(\s*'\[mock-billing\]\s+applyMockSubscription failed:',\s*\(err as Error\)\.message\s*\);", "logger.error('applyMockSubscription failed', { error: (err as Error).message });", "logger"),
    ("server/routes/mock-billing.ts", r"console\.error\(\s*'\[mock-billing\]\s+cancelMockSubscription failed:',\s*\(err as Error\)\.message\s*\);", "logger.error('cancelMockSubscription failed', { error: (err as Error).message });", "logger"),
    ("server/services/stripe-subscription.ts", r"console\.info\(`\[stripe\]\s+unhandled event type:\s+\$\{event\.type\}`\);", "logger.info('unhandled stripe event type', { eventType: event.type });", "logger"),
    ("server/services/stripe-subscription.ts", r"console\.warn\(\s*'\[stripe\]\s+subscription missing r3UserId metadata',\s*sub\.id\s*\);", "logger.warn('subscription missing r3UserId metadata', { subscriptionId: sub.id });", "logger"),
]

def color(t, c): 
    codes = {"green":"\033[92m","red":"\033[91m","yellow":"\033[93m","blue":"\033[94m","cyan":"\033[96m","reset":"\033[0m","bold":"\033[1m"}
    return f"{codes.get(c,'')}{t}{codes['reset']}"

def log_h(t): print(f"\n{color('═'*70,'cyan')}\n{color(t,'bold')}\n{color('═'*70,'cyan')}\n")
def log_s(t): print(f"{color('✓','green')} {t}")
def log_e(t): print(f"{color('✗','red')} {t}")
def log_w(t): print(f"{color('⚠','yellow')} {t}")
def log_i(t): print(f"{color('ℹ','blue')} {t}")

def find_import_pos(content: str) -> int:
    lines = content.split('\n')
    last = -1
    for i, line in enumerate(lines):
        s = line.strip()
        if not s or s.startswith('//'): continue
        if s.startswith(('import ', 'export ', 'type ')): last = i
        else: break
    return last + 1

def ensure_import(content: str, imp_line: str, imp_name: str) -> Tuple[str, bool]:
    if imp_name in content or '../utils/logger' in content: return content, False
    pos = find_import_pos(content)
    lines = content.split('\n')
    lines.insert(pos, imp_line)
    return '\n'.join(lines), True

def read_file(fp: Path) -> Optional[str]:
    try: return fp.read_text(encoding="utf-8")
    except: return None

def find_matches(content: str, pattern: str) -> List[Tuple[int, str]]:
    matches = []
    for i, line in enumerate(content.split('\n'), 1):
        if re.search(pattern, line): matches.append((i, line.strip()))
    return matches

def dry_run():
    log_h("PHASE 2: DRY-RUN (CORRECTED - imports at TOP)")
    summary = {}
    for fp, pattern, _, imp_name in FIXES:
        full_fp = PROJECT_ROOT / fp
        content = read_file(full_fp)
        if not content: continue
        matches = find_matches(content, pattern)
        if not matches: log_w(f"{fp}: Pattern not found")
        else:
            print(f"\n{color(fp,'cyan')}")
            print(f"  Matches: {len(matches)}")
            for ln, lc in matches: print(f"    Line {ln}: {lc[:60]}...")
            has_imp = imp_name in content
            if not has_imp:
                pos = find_import_pos(content)
                print(f"  {color('⚠','yellow')} Will add import at line {pos + 1} (TOP)")
            else: log_s(f"  Import present")
            summary[fp] = {"matches": len(matches), "has_import": has_imp, "insert_line": pos + 1}
    print(f"\n{color('Summary:','bold')}\n{json.dumps(summary, indent=2)}")

def backup(fp: Path) -> Optional[Path]:
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    bp = fp.with_suffix(f".{ts}.bak")
    try:
        bp.write_text(fp.read_text(encoding="utf-8"), encoding="utf-8")
        return bp
    except: return None

def apply():
    log_h("PHASE 4: APPLY (CORRECTED)")
    applied, failed = 0, 0
    for fp, pattern, new_code, imp_name in FIXES:
        full_fp = PROJECT_ROOT / fp
        log_i(f"Processing {fp}...")
        content = read_file(full_fp)
        if not content: failed += 1; continue
        bp = backup(full_fp)
        if bp: log_s(f"  Backup: {bp.name}")
        else: failed += 1; continue
        if imp_name not in content:
            content, added = ensure_import(content, LOGGER_IMPORT, imp_name)
            if added: log_i(f"  Added import at TOP")
        try:
            new_content = re.sub(pattern, new_code, content)
            if new_content == content: log_w(f"  Pattern not found"); failed += 1; continue
            full_fp.write_text(new_content, encoding="utf-8")
            log_s(f"  Applied")
            applied += 1
        except Exception as e: log_e(f"  Failed: {e}"); failed += 1
    print(f"\n{color('Applied:','green')} {applied}/{len(FIXES)}\n{color('Failed:','red')} {failed}/{len(FIXES)}")
    return applied, failed

def verify_tsc():
    log_h("PHASE 5: TSC VERIFICATION")
    try:
        log_i("Running: pnpm tsc -p server/tsconfig.json --noEmit")
        result = subprocess.run(["pnpm","tsc","-p","server/tsconfig.json","--noEmit"], capture_output=True, text=True, timeout=120)
        if result.returncode == 0: log_s("Server TSC: Zero errors ✓")
        else: log_e(f"TSC errors:\n{result.stderr[:300]}")
    except subprocess.TimeoutExpired: log_e("TSC timed out")
    except Exception as e: log_e(f"TSC failed: {e}")

def main():
    log_h("LOGGING PHASE 1 FIX (CORRECTED)")
    print(f"Working directory: {PROJECT_ROOT}")
    print(f"Fix: Imports placed at TOP (after existing imports)")
    if not (PROJECT_ROOT / "server").exists(): log_e("server/ not found"); sys.exit(1)
    
    log_h("PHASE 1: VERIFY FILES")
    for fp, _, _, _ in FIXES:
        full_fp = PROJECT_ROOT / fp
        if full_fp.exists(): log_s(f"Found: {fp}")
        else: log_e(f"Missing: {fp}")
    
    dry_run()
    print(f"\n{color('Ready to apply CORRECTED fixes?','bold')}")
    resp = input(f"{color('(yes/no):','cyan')} ").strip().lower()
    if resp != "yes": log_w("Aborted"); sys.exit(0)
    
    applied, failed = apply()
    verify_tsc()
    
    log_h("SUMMARY")
    print(f"{color('✓ Applied:','green')} {applied}\n{color('✗ Failed:','red')} {failed}")
    if failed == 0 and applied > 0: log_s("All fixes applied with imports at TOP!"); print("\nVerify: git diff server/ | head -100")
    else: log_w("Some issues detected")

if __name__ == "__main__": main()
