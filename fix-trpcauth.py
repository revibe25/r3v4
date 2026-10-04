#!/usr/bin/env python3
"""
fix-trpcauth.py — WIRE-protocol patch for the R3 v4 request hang.

ROOT CAUSE (evidence: server/middleware/auth.ts:61-63, index.ts:149, routes.ts:91)
    export function trpcAuth(req: Request) { return req.user; }
is mounted with app.use(trpcAuth). Express calls it as (req, res, next); it never
calls next() and never responds, so EVERY request after express.json() hangs —
including /api/auth/login (the frozen "AUTHENTICATING…" state) and 404s.
TypeScript accepts it because a 1-arg function is assignable to RequestHandler.

FIX: restore a pass-through verifier: Bearer JWT -> verifyToken -> req.user; ALWAYS next().
Do NOT just delete index.ts:149 — tRPC context reads req.user (trpc.ts:43), so
protected procedures would silently become unauthenticated.

USAGE (from repo root, e.g. ~/Projects/r3v4):
    python3 fix-trpcauth.py            # dry run (default): prints plan, touches nothing
    python3 fix-trpcauth.py --apply    # backup + patch + tsc gate (auto-rollback on new errors)
    python3 fix-trpcauth.py --apply --skip-tsc
"""
import argparse, datetime, pathlib, re, shutil, subprocess, sys

AUTH = pathlib.Path("server/middleware/auth.ts")
MOUNTS = [pathlib.Path("server/index.ts"), pathlib.Path("server/routes.ts")]

GETTER = re.compile(
    r"export\s+function\s+trpcAuth\s*\(\s*req\s*:\s*Request\s*\)\s*(?::\s*[^{]+)?\{\s*return\s+req\.user\s*;?\s*\}",
    re.S,
)
VERIFY = re.compile(r"export\s+(async\s+)?function\s+(verifyToken|verifyJwt|verifyAccessToken)\s*\(")
EXPRESS_IMPORT = re.compile(r"import\s*(type\s*)?\{([^}]*)\}\s*from\s*['\"]express['\"]\s*;?")

def die(msg, code=2):
    print(f"ABORT: {msg}"); sys.exit(code)

def tsc_errors():
    try:
        r = subprocess.run(["npx", "tsc", "--noEmit", "-p", "."], capture_output=True, text=True, timeout=600)
    except Exception as e:
        return None, str(e)
    out = r.stdout + r.stderr
    return len(re.findall(r"error TS\d+", out)), out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--skip-tsc", action="store_true")
    a = ap.parse_args()

    # ---- preflight / anchors -------------------------------------------------
    for f in [AUTH, *MOUNTS]:
        if not f.exists(): die(f"{f} not found — run from repo root")
    src = AUTH.read_text()
    hits = GETTER.findall(src)
    if len(hits) != 1:
        if re.search(r"function\s+trpcAuth\s*\(\s*req[^)]*,\s*_?res[^)]*,\s*next", src):
            print("Already fixed: trpcAuth takes (req, res, next). Nothing to do."); return
        die(f"expected exactly 1 getter-style trpcAuth in {AUTH}, found {len(hits)}")
    for m in MOUNTS:
        n = m.read_text().count("app.use(trpcAuth)")
        print(f"  anchor {m}: app.use(trpcAuth) x{n}")
        if n < 1: die(f"mount anchor missing in {m}")

    vm = VERIFY.search(src)
    if not vm:
        print("\nverifyToken-style export not found. Lines 1-60 of auth.ts:\n")
        for i, l in enumerate(src.splitlines()[:60], 1): print(f"{i:4}  {l}")
        die("cannot confirm the token verifier name/signature — no guessing (WIRE).")
    is_async, vname = bool(vm.group(1)), vm.group(2)
    print(f"  verifier: {'async ' if is_async else ''}{vname}()")

    call = f"await {vname}(token)" if is_async else f"{vname}(token)"
    head = "export async function" if is_async else "export function"
    replacement = f"""{head} trpcAuth(req: Request, _res: Response, next: NextFunction) {{
  // Pass-through: attach req.user when a valid Bearer JWT is present. Never rejects —
  // enforcement lives in requireUser / protectedProcedure. MUST always call next().
  try {{
    const [scheme, token] = (req.headers.authorization ?? "").split(" ");
    if (scheme === "Bearer" && token) {{
      const payload = {call};
      if (payload) (req as any).user = payload;
    }}
  }} catch {{
    /* invalid/expired token → anonymous request */
  }}
  next();
}}"""
    new_src = GETTER.sub(lambda _: replacement, src, count=1)

    im = EXPRESS_IMPORT.search(new_src)
    if im:
        names = [n.strip() for n in im.group(2).split(",") if n.strip()]
        base = {re.sub(r"^type\s+", "", n).split(" as ")[0] for n in names}
        for need in ("Response", "NextFunction"):
            if need not in base: names.append(need)
        new_src = new_src[:im.start()] + f"import {im.group(1) or ''}{{ {', '.join(names)} }} from \"express\";" + new_src[im.end():]
    else:
        new_src = 'import type { Request, Response, NextFunction } from "express";\n' + new_src

    print("\nPLAN")
    print(f"  {AUTH}: replace getter trpcAuth(req) with (req,_res,next) pass-through using {vname}()")
    print("  express import: ensure Response, NextFunction")
    print("  index.ts:149 / routes.ts:91 mounts: left as-is (double mount = redundant verify, harmless; dedupe later)")
    if not a.apply:
        print("\nDRY RUN — no files changed. Re-run with --apply."); return

    # ---- apply ---------------------------------------------------------------
    base_n = None
    if not a.skip_tsc:
        print("\n  tsc baseline…"); base_n, _ = tsc_errors(); print(f"  baseline errors: {base_n}")
    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    bak = AUTH.with_name(AUTH.name + f".bak-{stamp}")
    shutil.copy2(AUTH, bak); print(f"  backup: {bak}")
    AUTH.write_text(new_src); print(f"  patched: {AUTH}")

    if not a.skip_tsc and base_n is not None:
        after, out = tsc_errors()
        print(f"  tsc after: {after}")
        if after is None or after > base_n:
            shutil.copy2(bak, AUTH)
            print(out[-3000:]); die("new TypeScript errors → rolled back", 3)

    print("\n  residual references (excluding node_modules, dist):")
    subprocess.run("grep -rn 'trpcAuth' --include=*.ts --include=*.tsx . | grep -v node_modules | grep -v /dist/", shell=True)
    print("""
NEXT
  1. Rebuild stale server/dist (it still carries the old .d.ts).
  2. Restart server, then smoke test — both must return FAST:
       curl -s -o /dev/null -w '%{http_code} %{time_total}s\\n' localhost:3000/api/__nope      # expect 404
       curl -s -w ' %{http_code} %{time_total}s\\n' -H 'Content-Type: application/json' \\
            -d '{"credential":"probe","password":"probe"}' localhost:3000/api/auth/login   # expect 401
  3. If login now returns 500: DATABASE_URL has no password (psql prompts) — fix .env next.
  Rollback: cp BAK AUTHF""".replace("BAK", str(bak)).replace("AUTHF", str(AUTH)))

if __name__ == "__main__":
    main()
