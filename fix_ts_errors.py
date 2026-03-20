#!/usr/bin/env python3
"""
fix_ts_errors.py — Fix all 19 client TypeScript errors
=======================================================

  1. instrument-processor.worklet.ts (4)  — add to tsconfig.worklet.json include
  2. useBilling.ts (6)                    — rewrite trpc.billing.* → trpc.subscription.*
  3. LoopStation505.tsx (4)               — add missing getAudioContext import
  4. vst-store.ts (3)                     — fix wrong VSTPerformanceMonitor method names
  5. use-midi.ts (2)                      — add port null guard

USAGE:
  cd ~/Stable/R3\ v4/client
  python3 ../fix_ts_errors.py
  npx tsc --noEmit
"""

import os, sys, json, shutil

BASE = os.path.dirname(os.path.abspath(__file__))
# Script lives at project root, client is BASE/client
CLIENT = os.path.join(BASE, "client")
if not os.path.exists(os.path.join(CLIENT, "src")):
    # Maybe script is run from inside client/
    CLIENT = BASE

PASS, FAIL = [], []

def ok(m):   print(f"\033[0;32m  ✓ {m}\033[0m"); PASS.append(m)
def err(m):  print(f"\033[0;31m  ✗ {m}\033[0m"); FAIL.append(m)
def info(m): print(f"\033[0;36m  {m}\033[0m")

def path(rel): return os.path.join(CLIENT, rel)

def read(rel):
    p = path(rel)
    if not os.path.exists(p):
        err(f"File not found: {rel}"); return None
    with open(p, encoding="utf-8") as f: return f.read()

def write(rel, content, backup=True):
    p = path(rel)
    if backup and os.path.exists(p):
        shutil.copy2(p, p + ".bak")
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f: f.write(content)
    ok(f"Wrote {rel}")

def patch(rel, old, new, desc=""):
    content = read(rel)
    if content is None: return False
    if old not in content:
        err(f"Target not found in {rel}" + (f" ({desc})" if desc else ""))
        return False
    shutil.copy2(path(rel), path(rel) + ".bak")
    with open(path(rel), "w", encoding="utf-8") as f:
        f.write(content.replace(old, new, 1))
    ok(f"{rel} — {desc}")
    return True

# ═══════════════════════════════════════════════════════════════════════════════
# 1. tsconfig.worklet.json — add instrument-processor.worklet.ts to include
# ═══════════════════════════════════════════════════════════════════════════════

def fix_worklet_tsconfig():
    print("\n\033[1m1. tsconfig.worklet.json — add worklet to include\033[0m")
    rel = "tsconfig.worklet.json"
    p   = path(rel)
    if not os.path.exists(p):
        err(f"{rel} not found"); return

    with open(p, encoding="utf-8") as f:
        cfg = json.load(f)

    includes = cfg.get("include", [])
    target   = "src/worklets/instrument-processor.worklet.ts"
    if target in includes:
        ok(f"{target} already in include — skipping"); return

    shutil.copy2(p, p + ".bak")
    includes.append(target)
    cfg["include"] = includes

    with open(p, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2)
        f.write("\n")
    ok(f"Added {target} to tsconfig.worklet.json include")

# ═══════════════════════════════════════════════════════════════════════════════
# 2. useBilling.ts — rewrite trpc.billing.* → trpc.subscription.*
# ═══════════════════════════════════════════════════════════════════════════════

BILLING_NEW = '''import { trpc } from "../lib/trpc";

/**
 * Centralised billing hook — wraps subscription tRPC procedures.
 * The router is named `subscription` (not `billing`).
 * Import this instead of calling trpc.subscription.* directly.
 */
export function useBilling() {
  const utils = trpc.useUtils();

  const { data: subscription, isLoading: loadingSubscription } =
    trpc.subscription.getMySubscription.useQuery(undefined, {
      // Only fire when user is logged in
      enabled: Boolean(
        typeof window !== "undefined" &&
        (() => {
          try {
            const { useAuthStore } = require("../store/auth-store");
            return Boolean(useAuthStore.getState().token);
          } catch { return false; }
        })()
      ),
      retry: (count: number, error: any) => {
        if (error?.data?.code === "UNAUTHORIZED") return false;
        return count < 1;
      },
    });

  const { mutateAsync: createCheckout, isPending: creatingCheckout } =
    trpc.subscription.createCheckout.useMutation({
      onSuccess: ({ url }: { url: string }) => {
        window.location.href = url;
      },
    });

  const { mutateAsync: openPortal, isPending: openingPortal } =
    trpc.subscription.createPortal.useMutation({
      onSuccess: ({ url }: { url: string }) => {
        window.location.href = url;
      },
    });

  const isActive    = subscription?.status === "active";
  const isTrialing  = subscription?.status === "trialing";
  const isCancelled = subscription?.status === "canceled";

  return {
    subscription,
    isActive,
    isTrialing,
    isCancelled,
    loadingSubscription,
    // Checkout: pass { tier, billingCycle }
    createCheckout,
    creatingCheckout,
    // Portal: pass {} or { returnPath }
    openPortal,
    openingPortal,
    // Invalidate subscription cache manually if needed
    invalidate: () => utils.subscription.getMySubscription.invalidate(),
  };
}
'''

def fix_billing():
    print("\n\033[1m2. useBilling.ts — rewrite to trpc.subscription.*\033[0m")
    write("src/hooks/useBilling.ts", BILLING_NEW)

# ═══════════════════════════════════════════════════════════════════════════════
# 3. LoopStation505.tsx — add missing getAudioContext import
# ═══════════════════════════════════════════════════════════════════════════════

def fix_loopstation():
    print("\n\033[1m3. LoopStation505.tsx — add getAudioContext import\033[0m")
    rel = "src/features/loopstation/LoopStation505.tsx"

    content = read(rel)
    if content is None: return

    # Check if already imported
    if "getAudioContext" in content.split("from '@/audio/core/audio-context'")[0] if "'@/audio/core/audio-context'" in content else "":
        ok("getAudioContext already imported"); return

    # Find the first import from the audio core area, or from loopEngine
    # and add getAudioContext import after it
    targets = [
        "import { getLoopEngine }",
        "from '../engine/loopEngine'",
        "from '@/features/loopstation/engine/loopEngine'",
    ]

    inserted = False
    for t in targets:
        # Find the full import line containing this string
        lines = content.split("\n")
        for i, line in enumerate(lines):
            if t in line and line.strip().startswith("import"):
                lines.insert(i + 1, "import { getAudioContext } from '@/audio/core/audio-context';")
                shutil.copy2(path(rel), path(rel) + ".bak")
                with open(path(rel), "w", encoding="utf-8") as f:
                    f.write("\n".join(lines))
                ok(f"Inserted getAudioContext import after line {i+1}")
                inserted = True
                break
        if inserted: break

    if not inserted:
        # Fallback: prepend after the first import block
        first_import = content.find("import ")
        if first_import == -1:
            err("No import statement found in LoopStation505.tsx"); return
        # Find end of first import line
        end = content.find("\n", first_import)
        new_content = (
            content[:end + 1] +
            "import { getAudioContext } from '@/audio/core/audio-context';\n" +
            content[end + 1:]
        )
        shutil.copy2(path(rel), path(rel) + ".bak")
        with open(path(rel), "w", encoding="utf-8") as f:
            f.write(new_content)
        ok("Inserted getAudioContext import (fallback position)")

# ═══════════════════════════════════════════════════════════════════════════════
# 4. vst-store.ts — fix wrong VSTPerformanceMonitor method names
#
#    onCPUOverload   → onOverload   (method exists, confirmed from error message)
#    onMemoryWarning → does not exist — replace with safe no-op comment
#    onDropout       → does not exist — replace with safe no-op comment
# ═══════════════════════════════════════════════════════════════════════════════

def fix_vst_store():
    print("\n\033[1m4. vst-store.ts — fix VSTPerformanceMonitor method names\033[0m")
    rel = "src/store/vst-store.ts"

    # Fix onCPUOverload → onOverload
    patch(rel,
        "performanceMonitor.onCPUOverload = (usage) => {",
        "performanceMonitor.onOverload(() => {",
        "onCPUOverload → onOverload",
    )

    # The callback signature changed (no usage param) — fix closing
    content = read(rel)
    if content is None: return

    # onMemoryWarning assignment — replace whole assignment block with a comment
    if "performanceMonitor.onMemoryWarning" in content:
        shutil.copy2(path(rel), path(rel) + ".bak")
        lines = content.split("\n")
        out   = []
        skip  = False
        for line in lines:
            if "performanceMonitor.onMemoryWarning" in line:
                out.append("          // onMemoryWarning: not available on VSTPerformanceMonitor")
                skip = True
                continue
            if skip:
                # Skip until closing brace of the assignment block
                stripped = line.strip()
                if stripped in ("};", "}"):
                    skip = False
                continue
            out.append(line)
        content = "\n".join(out)
        with open(path(rel), "w", encoding="utf-8") as f:
            f.write(content)
        ok(f"{rel} — removed onMemoryWarning (method does not exist)")

    content = read(rel)
    if content is None: return

    if "performanceMonitor.onDropout" in content:
        shutil.copy2(path(rel), path(rel) + ".bak")
        lines = content.split("\n")
        out   = []
        skip  = False
        for line in lines:
            if "performanceMonitor.onDropout" in line:
                out.append("          // onDropout: not available on VSTPerformanceMonitor")
                skip = True
                continue
            if skip:
                stripped = line.strip()
                if stripped in ("};", "}"):
                    skip = False
                continue
            out.append(line)
        content = "\n".join(out)
        with open(path(rel), "w", encoding="utf-8") as f:
            f.write(content)
        ok(f"{rel} — removed onDropout (method does not exist)")

# ═══════════════════════════════════════════════════════════════════════════════
# 5. use-midi.ts — add null guard on port
# ═══════════════════════════════════════════════════════════════════════════════

def fix_use_midi():
    print("\n\033[1m5. use-midi.ts — add port null guard\033[0m")
    rel = "src/hooks/use-midi.ts"

    patch(rel,
        "if (port.type === 'input') {",
        "if (port && port.type === 'input') {",
        "add null guard — port.type",
    )
    patch(rel,
        "if (port.state === 'connected') wireInput(port as MIDIInput);",
        "if (port && port.state === 'connected') wireInput(port as MIDIInput);",
        "add null guard — port.state",
    )

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    print("\n\033[1;37m═══════════════════════════════════════════════════════\033[0m")
    print("\033[1;37m  R3 v4 — Fix 19 TypeScript client errors\033[0m")
    print("\033[1;37m═══════════════════════════════════════════════════════\033[0m")

    if not os.path.exists(os.path.join(CLIENT, "src")):
        err(f"client/src not found under {CLIENT}"); sys.exit(1)

    fix_worklet_tsconfig()
    fix_billing()
    fix_loopstation()
    fix_vst_store()
    fix_use_midi()

    print(f"\n\033[1;37m═══════════════════════════════════════════════════════\033[0m")
    if FAIL:
        print(f"  \033[0;32m{len(PASS)} ok\033[0m  \033[0;31m{len(FAIL)} failed\033[0m")
        for f in FAIL: print(f"    ✗ {f}")
    else:
        print(f"  \033[0;32mAll {len(PASS)} fixes applied.\033[0m")
    print(f"\033[1;37m═══════════════════════════════════════════════════════\033[0m\n")
    print("Run:  cd client && npx tsc --noEmit")
    print()

if __name__ == "__main__":
    main()