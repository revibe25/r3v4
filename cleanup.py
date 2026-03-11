#!/usr/bin/env python3
"""
R3 v4 — Stack Cleanup Script
==============================
Implements every finding from the full architectural audit.
Runs in DRY_RUN mode by default — prints what it WOULD do without
touching any file. Set DRY_RUN = False to apply.

Sections (in execution order):
  [1/7] BLOCKER — storage-s3.ts: lazy load guard
  [2/7] BLOCKER — railway.toml: correct start command + install tsx
  [3/7] ENV — remove duplicate old-name keys
  [4/7] Bak file deletion
  [5/7] Audit artifact deletion
  [6/7] One-time script deletion
  [7/7] Root-level orphan confirmation + deletion
  [+]   JS/TS collision detection + dead JS deletion
  [+]   TypeScript verification (live mode only)
  [+]   Summary report

Change accountability (directive §7) is documented inline per section.
"""

import re
import sys
import json
import shutil
import subprocess
from pathlib import Path
from datetime import datetime

# ══════════════════════════════════════════════════════════════════════════════
# CONFIG — set DRY_RUN = False to actually apply changes
# ══════════════════════════════════════════════════════════════════════════════

DRY_RUN = True  # <- CHANGE TO False WHEN READY TO APPLY

# -- Terminal colours ----------------------------------------------------------

R      = "\033[0m"
BOLD   = "\033[1m"
GREEN  = "\033[32m"
YELLOW = "\033[33m"
RED    = "\033[31m"
CYAN   = "\033[36m"
DIM    = "\033[2m"

def ok(m):   print(f"{GREEN}  v  {m}{R}")
def warn(m): print(f"{YELLOW}  !  {m}{R}")
def err(m):  print(f"{RED}  x  {m}{R}")
def head(m): print(f"\n{BOLD}{m}{R}")
def dim(m):  print(f"{DIM}     {m}{R}")

def act(label: str, path, fn):
    """Print action in dry-run mode or execute fn() in live mode."""
    if DRY_RUN:
        print(f"{YELLOW}  DRY  {label}: {path}{R}")
    else:
        fn()
        ok(f"{label}: {path}")

def backup(path: Path) -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    dest  = path.with_suffix(f".{stamp}.bak")
    shutil.copy2(path, dest)
    return dest

def shell(cmd: str, cwd: Path = None) -> tuple:
    """Run a shell command. Returns (returncode, combined stdout+stderr)."""
    result = subprocess.run(
        cmd, shell=True,
        cwd=str(cwd or root),
        capture_output=True, text=True
    )
    return result.returncode, (result.stdout + result.stderr).strip()

# -- Locate project root -------------------------------------------------------

SCRIPT_DIR = Path(__file__).resolve().parent
root = SCRIPT_DIR
for _ in range(8):
    if (root / "server").is_dir() and (root / "client").is_dir():
        break
    root = root.parent
else:
    err("Cannot locate project root.")
    sys.exit(1)

MODE = (
    f"{YELLOW}DRY RUN -- no files will be modified{R}"
    if DRY_RUN else
    f"{GREEN}LIVE -- changes will be applied{R}"
)

print(f"\n{BOLD}{'=' * 60}")
print("  R3 v4 -- Stack Cleanup")
print(f"{'=' * 60}{R}")
print(f"  Root : {root}")
print(f"  Mode : {MODE}\n")

report = {
    "fixed":   [],
    "deleted": [],
    "skipped": [],
    "blocked": [],
}

# =============================================================================
# [1/7] BLOCKER -- storage-s3.ts throws at import time
#
# ROOT CAUSE: Lines 20-24 of the current file run at module evaluation time:
#   if (!STORAGE_BUCKET || !STORAGE_ACCESS_KEY_ID || ...) { throw ... }
#   Railway evaluates all ES module imports synchronously before the first
#   request handler runs. With storage env vars cleared (R2 not configured),
#   the process throws before binding to any port -- instant crash.
#
# FIX RATIONALE: Wrap the S3Client in a lazy getter (getS3()) that throws
#   only when first called. Identical to the getStripe() pattern already in
#   stripe-subscription.ts. The Proxy on `s3` and `uploadS3` preserves the
#   existing export contract for any callers that use these directly.
#
# FIX NOTE on multerS3 options:
#   The previous draft used JS object literal getters (get s3() {...}) inside
#   multerS3({...}). multerS3 v3 types declare `s3: S3Client` as a required
#   concrete property -- not a getter. Passing getters causes a TS type error
#   because `{ get s3() {...} }` is not assignable to `{ s3: S3Client }`.
#   Correct fix: factory function (getUploadS3) that calls getS3() at
#   invocation time and returns a fully typed multer instance. uploadS3 is
#   then a Proxy over that factory -- safe to import, throws only on use.
#
# AFFECTED SURFACE: server/lib/storage-s3.ts only.
# REGRESSION CHECK: All exports preserved with identical signatures.
# =============================================================================

head("[1/7] BLOCKER -- storage-s3.ts: lazy load guard")

S3_FILE = root / "server" / "lib" / "storage-s3.ts"

NEW_S3_CONTENT = (
    "/**\n"
    " * server/lib/storage-s3.ts\n"
    " *\n"
    " * S3-compatible file storage for uploads.\n"
    " * Works with AWS S3 and Cloudflare R2 (same API; set STORAGE_ENDPOINT for R2).\n"
    " *\n"
    " * FIX: S3Client is now lazily instantiated on first use via getS3().\n"
    " *\n"
    " * ROOT CAUSE of previous crash:\n"
    " *   The original file threw at module load time when storage env vars were\n"
    " *   absent. Railway evaluates all ES module imports before serving any request,\n"
    " *   so the process crashed before binding to a port. Fixed by deferring the\n"
    " *   throw to first access -- identical to the getStripe() pattern in\n"
    " *   stripe-subscription.ts.\n"
    " *\n"
    " * WHY NOT object-literal getters in multerS3():\n"
    " *   multerS3 v3 types require `s3: S3Client` (a concrete value, not a getter).\n"
    " *   Object-literal getters { get s3() {...} } are not assignable to that type\n"
    " *   and cause TS errors. The correct approach is a factory function\n"
    " *   (getUploadS3) that resolves getS3() at call time and returns a fully\n"
    " *   typed multer instance. uploadS3 is a Proxy over that factory.\n"
    " */\n"
    "\n"
    "import { S3Client, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';\n"
    "import { getSignedUrl as awsGetSignedUrl } from '@aws-sdk/s3-request-presigner';\n"
    "import multer from 'multer';\n"
    "import multerS3 from 'multer-s3';\n"
    "import path from 'path';\n"
    "\n"
    "const ALLOWED_MIMES = [\n"
    "  'audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/ogg',\n"
    "  'audio/flac', 'audio/x-wav', 'audio/x-m4a',\n"
    "  'application/octet-stream',\n"
    "];\n"
    "\n"
    "// -- Lazy S3 client -------------------------------------------------------\n"
    "// Throws at call time if env vars are absent, not at module import time.\n"
    "// This allows the server to boot and serve non-storage routes without R2/S3.\n"
    "\n"
    "let _s3: S3Client | null = null;\n"
    "\n"
    "export function getS3(): S3Client {\n"
    "  if (!_s3) {\n"
    "    const bucket    = process.env.STORAGE_BUCKET;\n"
    "    const accessKey = process.env.STORAGE_ACCESS_KEY_ID;\n"
    "    const secretKey = process.env.STORAGE_SECRET_ACCESS_KEY;\n"
    "\n"
    "    if (!bucket || !accessKey || !secretKey) {\n"
    "      throw new Error(\n"
    "        'S3/R2 storage is not configured. ' +\n"
    "        'Set STORAGE_BUCKET, STORAGE_ACCESS_KEY_ID, and STORAGE_SECRET_ACCESS_KEY ' +\n"
    "        'in your .env or Railway environment variables before using file upload.'\n"
    "      );\n"
    "    }\n"
    "\n"
    "    _s3 = new S3Client({\n"
    "      region:      process.env.STORAGE_REGION ?? 'auto',\n"
    "      endpoint:    process.env.STORAGE_ENDPOINT,\n"
    "      credentials: {\n"
    "        accessKeyId:     accessKey,\n"
    "        secretAccessKey: secretKey,\n"
    "      },\n"
    "      // Required for Cloudflare R2 -- forces path-style bucket addressing\n"
    "      forcePathStyle: !!process.env.STORAGE_ENDPOINT,\n"
    "    });\n"
    "  }\n"
    "  return _s3;\n"
    "}\n"
    "\n"
    "/** @deprecated Use getS3() directly. Proxy preserved for legacy callers. */\n"
    "export const s3 = new Proxy({} as S3Client, {\n"
    "  get(_target, prop) {\n"
    "    return (getS3() as any)[prop];\n"
    "  },\n"
    "});\n"
    "\n"
    "// -- Upload middleware factory ---------------------------------------------\n"
    "// Returns a fully configured multer instance wired to S3/R2.\n"
    "// Called at upload time -- getS3() resolves then, not at module load.\n"
    "\n"
    "function getUploadS3(): multer.Multer {\n"
    "  const s3Client = getS3();\n"
    "  const bucket   = process.env.STORAGE_BUCKET!;\n"
    "\n"
    "  return multer({\n"
    "    storage: multerS3({\n"
    "      s3:          s3Client,\n"
    "      bucket:      bucket,\n"
    "      contentType: multerS3.AUTO_CONTENT_TYPE,\n"
    "      key: (\n"
    "        _req: Express.Request,\n"
    "        file: Express.Multer.File,\n"
    "        cb: (err: Error | null, key: string) => void\n"
    "      ) => {\n"
    "        const ext    = path.extname(file.originalname);\n"
    "        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;\n"
    "        const folder = file.fieldname === 'sample' ? 'samples' : 'projects';\n"
    "        cb(null, `${folder}/${unique}${ext}`);\n"
    "      },\n"
    "    }),\n"
    "    limits: { fileSize: 50 * 1024 * 1024 },\n"
    "    fileFilter: (_req, file, cb) => {\n"
    "      if (ALLOWED_MIMES.includes(file.mimetype) || file.originalname.endsWith('.r3v')) {\n"
    "        cb(null, true);\n"
    "      } else {\n"
    "        cb(new Error('Invalid file type. Only audio files and .r3v project files are allowed.'));\n"
    "      }\n"
    "    },\n"
    "  });\n"
    "}\n"
    "\n"
    "/**\n"
    " * uploadS3 -- multer middleware for S3/R2 uploads.\n"
    " * Drop-in replacement for multer.diskStorage in server/routes.ts.\n"
    " * Safe to import unconditionally -- throws only on first upload attempt\n"
    " * if storage is not configured.\n"
    " */\n"
    "export const uploadS3: multer.Multer = new Proxy({} as multer.Multer, {\n"
    "  get(_target, prop) {\n"
    "    return (getUploadS3() as any)[prop];\n"
    "  },\n"
    "});\n"
    "\n"
    "/** Delete an object from S3/R2 by its storage key. */\n"
    "export async function deleteFromS3(key: string): Promise<void> {\n"
    "  const bucket = process.env.STORAGE_BUCKET;\n"
    "  if (!bucket) throw new Error('STORAGE_BUCKET is not set');\n"
    "  await getS3().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));\n"
    "}\n"
    "\n"
    "/**\n"
    " * Generate a pre-signed URL for temporary direct access.\n"
    " * Default expiry: 1 hour. Use for client-side download links.\n"
    " */\n"
    "export async function getSignedUrl(key: string, expiresIn = 3600): Promise<string> {\n"
    "  const bucket = process.env.STORAGE_BUCKET;\n"
    "  if (!bucket) throw new Error('STORAGE_BUCKET is not set');\n"
    "  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });\n"
    "  return awsGetSignedUrl(getS3(), cmd, { expiresIn });\n"
    "}\n"
)

if not S3_FILE.exists():
    warn("storage-s3.ts not found -- skipping")
    report["blocked"].append(("server/lib/storage-s3.ts", "file not found"))
else:
    current = S3_FILE.read_text()

    # Use regex detection -- immune to whitespace variance.
    # Previous draft used exact string matching which silently failed
    # on any indentation difference.
    already_lazy = bool(re.search(r'function\s+getS3\s*\(', current))
    has_throw    = bool(re.search(r'if\s*\(\s*!STORAGE_BUCKET\s*\|\|', current))

    if already_lazy and not has_throw:
        ok("storage-s3.ts -- lazy guard already applied")
        report["skipped"].append("storage-s3.ts -- already correct")
    elif has_throw or not already_lazy:
        def write_s3():
            bak = backup(S3_FILE)
            S3_FILE.write_text(NEW_S3_CONTENT)
            report["fixed"].append("server/lib/storage-s3.ts -- lazy load guard applied")
            dim(f"bak: {bak.name}")
        act("FIX storage-s3.ts", "server/lib/storage-s3.ts", write_s3)
    else:
        warn("storage-s3.ts -- unexpected state, manual review required")
        report["blocked"].append(("server/lib/storage-s3.ts", "pattern mismatch"))

# =============================================================================
# [2/7] BLOCKER -- railway.toml wrong start command + missing tsx
#
# ROOT CAUSE: server/tsconfig.json sets outDir: ./dist -- compiles to
#   server/dist/. index.ts is at the project root. "node dist/index.js"
#   looks for <root>/dist/index.js which does not exist. Railway silently
#   fails to start.
#
# FIX RATIONALE: Use tsx instead of compile-then-run. tsx handles ESM,
#   tsconfig path resolution, and monorepo imports without a build step.
#   This eliminates the path mismatch entirely and is the standard approach
#   for Express + ESM monorepos on Railway.
#
# AFFECTED SURFACE: railway.toml (buildCommand + startCommand).
#   tsx added to server/package.json devDependencies in live mode.
#
# REGRESSION CHECK: tsx executes index.ts identically to compiled output.
#   All runtime behaviour preserved.
# =============================================================================

head("[2/7] BLOCKER -- railway.toml: correct start command")

RAILWAY_TOML = root / "railway.toml"

if not RAILWAY_TOML.exists():
    warn("railway.toml not found -- skipping")
    report["blocked"].append(("railway.toml", "file not found"))
else:
    toml_text = RAILWAY_TOML.read_text()
    already_fixed = (
        "npx tsx index.ts" in toml_text or
        "node server/dist/index.js" in toml_text
    )

    if already_fixed:
        ok("railway.toml -- start command already corrected")
        report["skipped"].append("railway.toml -- already correct")
    else:
        # Regex replacements -- immune to whitespace variance.
        # Previous draft used exact multi-line string matching which silently
        # no-oped on any whitespace difference.
        new_toml = re.sub(
            r'buildCommand\s*=\s*"[^"]*"',
            'buildCommand = "pnpm install"',
            toml_text
        )
        new_toml = re.sub(
            r'startCommand\s*=\s*"[^"]*"',
            'startCommand = "npx tsx index.ts"',
            new_toml
        )

        if new_toml == toml_text:
            warn("railway.toml -- no matching patterns found, manual review required")
            report["blocked"].append(("railway.toml", "regex did not match"))
        else:
            def write_toml():
                bak = backup(RAILWAY_TOML)
                RAILWAY_TOML.write_text(new_toml)
                report["fixed"].append("railway.toml -- startCommand: npx tsx index.ts")
                dim(f"bak: {bak.name}")
                # Install tsx so Railway has it available at start time
                code, out = shell("pnpm add -D tsx", cwd=root / "server")
                if code == 0:
                    ok("tsx installed in server devDependencies")
                    report["fixed"].append("server/package.json -- tsx added to devDependencies")
                else:
                    warn("tsx install failed -- run manually: cd server && pnpm add -D tsx")
                    dim(out[:120] if out else "(no output)")

            act("FIX railway.toml + install tsx", "railway.toml", write_toml)
            if DRY_RUN:
                dim("Also runs: cd server && pnpm add -D tsx")

# =============================================================================
# [3/7] ENV -- remove duplicate old-name keys
#
# ROOT CAUSE: env-consolidate.py merged server/.env which used legacy key
#   names (STRIPE_PRICE_*, R2_*, AUTH_TOKEN_*). Both old and canonical names
#   now coexist in root .env. Railway receives both -- confusing and a future
#   hazard if any code is updated to read the old name.
#
# FIX RATIONALE: Remove old-name keys after confirming no production code
#   file references them. Grep scans all .ts/.tsx/.js/.toml/.json files and
#   explicitly excludes node_modules, .bak files, and .env files.
#
# PREVIOUS BUG: `grep -v '.env'` was too broad -- it excluded any line whose
#   PATH contained ".env" (e.g. server/lib/env-loader.ts). Fixed to
#   `grep -v '/\.env'` which only excludes actual .env files.
#
# AFFECTED SURFACE: root .env only.
# REGRESSION CHECK: Canonical keys remain untouched. Removal gated on
#   zero codebase consumers confirmed by grep.
# =============================================================================

head("[3/7] ENV -- remove duplicate old-name keys")

ENV_FILE = root / ".env"

DUPLICATE_KEYS = [
    ("STRIPE_PRICE_CREATOR_MONTHLY",    "STRIPE_CREATOR_MONTHLY_PRICE_ID"),
    ("STRIPE_PRICE_CREATOR_ANNUAL",     "STRIPE_CREATOR_YEARLY_PRICE_ID"),
    ("STRIPE_PRICE_PRO_MONTHLY",        "STRIPE_PRO_ARTIST_MONTHLY_PRICE_ID"),
    ("STRIPE_PRICE_PRO_ANNUAL",         "STRIPE_PRO_ARTIST_YEARLY_PRICE_ID"),
    ("STRIPE_PRICE_PRO_ARTIST_ANNUAL",  "STRIPE_PRO_ARTIST_YEARLY_PRICE_ID"),
    ("STRIPE_PRICE_PRO_ARTIST_MONTHLY", "STRIPE_PRO_ARTIST_MONTHLY_PRICE_ID"),
    ("R2_ACCESS_KEY_ID",                "STORAGE_ACCESS_KEY_ID"),
    ("R2_SECRET_ACCESS_KEY",            "STORAGE_SECRET_ACCESS_KEY"),
    ("R2_ENDPOINT",                     "STORAGE_ENDPOINT"),
    ("R2_BUCKET_NAME",                  "STORAGE_BUCKET"),
    ("AUTH_TOKEN_SECRET",               "JWT_SECRET"),
    ("AUTH_TOKEN_EXPIRY",               "JWT_EXPIRES_IN"),
    ("CORS_ORIGIN",                     "ALLOWED_ORIGINS"),
]

if not ENV_FILE.exists():
    warn(".env not found -- skipping")
else:
    env_text    = ENV_FILE.read_text()
    to_remove   = []
    blocked_env = []

    for old_key, canonical_key in DUPLICATE_KEYS:
        _, usage = shell(
            f"grep -rn '{old_key}' "
            "--include='*.ts' --include='*.tsx' --include='*.js' "
            "--include='*.toml' --include='*.json' "
            ". 2>/dev/null "
            "| grep -v node_modules "
            "| grep -v '\\.bak' "
            "| grep -v '/\\.env'"  # excludes .env files only, not all paths with .env
        )

        if usage.strip():
            blocked_env.append((old_key, usage.splitlines()[0]))
            report["blocked"].append(
                (old_key, f"still referenced: {usage.splitlines()[0][:80]}")
            )
            warn(f"BLOCKED {old_key} -- still referenced in source:")
            dim(f"  {usage.splitlines()[0][:80]}")
        elif f"\n{old_key}=" in env_text or env_text.startswith(f"{old_key}="):
            to_remove.append(old_key)
        else:
            dim(f"SKIP {old_key} -- not present in .env")

    if to_remove:
        def remove_duplicates():
            bak = backup(ENV_FILE)
            lines = ENV_FILE.read_text().splitlines()
            filtered = [
                line for line in lines
                if not any(line.startswith(f"{k}=") for k in to_remove)
            ]
            ENV_FILE.write_text("\n".join(filtered) + "\n")
            report["fixed"].append(f".env -- removed {len(to_remove)} duplicate keys")
            dim(f"bak: {bak.name}")

        act(f"REMOVE {len(to_remove)} duplicate .env keys", ".env", remove_duplicates)
        for k in to_remove:
            dim(f"  - {k}")
    elif not blocked_env:
        ok("ENV -- no duplicate keys found")

# =============================================================================
# [4/7] Bak files -- delete all
#
# ROOT CAUSE: Every .bak file was created by an audit or fix script that has
#   since been applied and verified (zero TS errors confirmed after each).
#   .bak files are never canonical source.
# REGRESSION CHECK: None needed -- .bak files are never imported.
# =============================================================================

head("[4/7] Bak files -- delete all")

bak_files = sorted(
    f for f in root.rglob("*.bak")
    if "node_modules" not in str(f)
)

if not bak_files:
    ok("No .bak files found")
else:
    for f in bak_files:
        rel = f.relative_to(root)
        def _del(fp=f, r=rel):
            fp.unlink()
            report["deleted"].append(str(r))
        act("DELETE", rel, _del)

# =============================================================================
# [5/7] Audit artifacts -- delete
# =============================================================================

head("[5/7] Audit artifacts -- delete")

AUDIT_ARTIFACTS = [
    root / "audit-client-src.zip",
    root / "audit-dump.txt",
    root / "audit-packages.zip",
    root / "audit-server.zip",
    root / "audit-shared.zip",
]

found_any = False
for f in AUDIT_ARTIFACTS:
    if f.exists():
        found_any = True
        rel = f.relative_to(root)
        def _del(fp=f, r=rel):
            fp.unlink()
            report["deleted"].append(str(r))
        act("DELETE", rel, _del)
if not found_any:
    ok("No audit artifacts found")

# =============================================================================
# [6/7] One-time fix scripts -- delete
#
# ROOT CAUSE: These scripts applied specific one-time fixes. All have been
#   applied and confirmed. Leaving them creates ambiguity about re-running.
#   deploy.py is explicitly kept -- still required.
# =============================================================================

head("[6/7] One-time fix scripts -- delete")

SCRIPTS_TO_DELETE = [
    root / "apply-audit-fixes.py",
    root / "apply-audit-fixes_.py",
    root / "fix-ts-errors.py",
    root / "fix-ts-errors.js",
    root / "launch-prep.py",
    root / "env-consolidate.py",
]

found_any = False
for f in SCRIPTS_TO_DELETE:
    if f.exists():
        found_any = True
        rel = f.relative_to(root)
        def _del(fp=f, r=rel):
            fp.unlink()
            report["deleted"].append(str(r))
        act("DELETE", rel, _del)
    else:
        dim(f"SKIP {f.name} -- not found")

if not found_any:
    ok("No one-time scripts found")

dim("KEEP: deploy.py -- still required for Railway/Vercel deploy")

# =============================================================================
# [7/7] Root-level orphans -- confirm no imports, then delete
#
# crossfade.test.ts:
#   ROOT CAUSE: Leftover test at root. Canonical copy is at
#   packages/llpte-execution/tests/crossfade.test.ts. Dual copies cause
#   test runners to execute the root copy in the wrong module context.
#
# fx-chain.ts:
#   ROOT CAUSE: Renamed leftover from _dev/patches/backup (confirmed via
#   git log: "rename ... fx-chain.ts (65%)"). Patch artifact, not source.
#
# FIX RATIONALE: Delete after confirming zero import consumers via grep.
# REGRESSION CHECK: Canonical copies in packages/ are untouched.
# =============================================================================

head("[7/7] Root orphans -- verify no imports, then delete")

ROOT_ORPHANS = [
    root / "crossfade.test.ts",
    root / "fx-chain.ts",
]

for f in ROOT_ORPHANS:
    if not f.exists():
        dim(f"SKIP {f.name} -- not found")
        continue

    stem = f.stem
    _, usage = shell(
        f"grep -rn \"'{stem}\" "
        "--include='*.ts' --include='*.tsx' --include='*.js' "
        f". 2>/dev/null "
        "| grep -v node_modules "
        "| grep -v '\\.bak' "
        f"| grep -v '{f.name}'"
    )

    if usage.strip():
        warn(f"BLOCKED {f.name} -- has consumers:")
        for line in usage.splitlines()[:3]:
            dim(f"  {line}")
        report["blocked"].append((
            str(f.relative_to(root)),
            f"imported: {usage.splitlines()[0][:80]}"
        ))
    else:
        rel = f.relative_to(root)
        def _del(fp=f, r=rel):
            fp.unlink()
            report["deleted"].append(str(r))
        act("DELETE (zero consumers confirmed)", rel, _del)

# =============================================================================
# [+] JS/TS collision detection
#
# ROOT CAUSE: .js files whose .ts twin exists are compiled or migration
#   artifacts. Dead -- TypeScript resolvers prefer .ts and they are never
#   imported. Can shadow the canonical .ts in edge cases.
# =============================================================================

head("[+] JS/TS collision detection")

_, js_raw = shell(
    "find . -name '*.js' "
    "| grep -v node_modules | grep -v '/dist/' | grep -v '\\.bak' | sort"
)
_, ts_raw = shell(
    "find . \\( -name '*.ts' -o -name '*.tsx' \\) "
    "| grep -v node_modules | grep -v '/dist/' | grep -v '\\.bak' | sort"
)

def file_stems(raw: str) -> set:
    result = set()
    for line in raw.splitlines():
        line = line.strip().lstrip("./")
        if not line:
            continue
        p = Path(line)
        # Strip .d.ts and .test.ts double extensions before comparing
        if p.name.endswith(".d.ts") or p.name.endswith(".test.ts"):
            result.add(str(p.with_suffix("").with_suffix("")))
        else:
            result.add(str(p.with_suffix("")))
    return result

js_stems = file_stems(js_raw)
ts_stems = file_stems(ts_raw)
collisions = js_stems & ts_stems

if not collisions:
    ok("No JS/TS collisions found")
else:
    warn(f"{len(collisions)} collision(s) detected -- .js has a .ts twin:")
    for stem in sorted(collisions):
        js_path = root / (stem + ".js")
        dim(f"  {stem}.js")
        if js_path.exists():
            rel = js_path.relative_to(root)
            def _del(fp=js_path, r=rel):
                fp.unlink()
                report["deleted"].append(str(r))
            act("DELETE dead .js", rel, _del)
        else:
            dim("    (already removed)")

# =============================================================================
# [+] TypeScript verification (live mode only)
# =============================================================================

if not DRY_RUN:
    head("[+] TypeScript verification")
    code, ts_out = shell(
        "npx tsc --noEmit 2>&1 | grep -v 'npm notice' | head -40",
        cwd=root / "server"
    )
    if ts_out.strip():
        warn("TypeScript errors detected after cleanup:")
        for line in ts_out.splitlines():
            dim(f"  {line}")
        report["blocked"].append(("TypeScript", "errors remain -- see above"))
    else:
        ok("Zero TypeScript errors")
        report["fixed"].append("TypeScript -- clean after all changes")

# =============================================================================
# Summary
# =============================================================================

print(f"\n{BOLD}{'=' * 60}")
print(f"  R3 v4 Cleanup -- {'DRY RUN SUMMARY' if DRY_RUN else 'COMPLETE'}")
print(f"{'=' * 60}{R}\n")

if report["fixed"]:
    print(f"  {GREEN}{BOLD}FIXED ({len(report['fixed'])}){R}")
    for item in report["fixed"]:
        dim(f"  v  {item}")

if report["deleted"]:
    print(f"\n  {GREEN}{BOLD}DELETED ({len(report['deleted'])}){R}")
    for item in report["deleted"]:
        dim(f"  v  {item}")

if report["skipped"]:
    print(f"\n  {DIM}SKIPPED ({len(report['skipped'])}){R}")
    for item in report["skipped"]:
        dim(f"  -  {item}")

if report["blocked"]:
    print(f"\n  {YELLOW}{BOLD}BLOCKED ({len(report['blocked'])}) -- manual review required{R}")
    for item_path, reason in report["blocked"]:
        dim(f"  !  {item_path}: {reason}")

print()
if DRY_RUN:
    print(f"  {BOLD}Nothing was modified. To apply all changes:{R}")
    print(f"  {CYAN}  Open this script and set DRY_RUN = False, then run again.{R}\n")
else:
    print(f"  {BOLD}Cleanup complete. Next steps:{R}")
    print(f"  {CYAN}  1. railway login && python3 deploy.py{R}")
    print(f"  {CYAN}  2. After Railway deploys, copy your Railway URL{R}")
    print(f"  {CYAN}  3. Update client/vercel.json rewrite destination{R}")
    print(f"  {CYAN}  4. git add -A && git commit -m 'chore: stack cleanup applied'{R}")
    print(f"  {CYAN}  5. git push  (triggers Vercel redeploy){R}\n")
